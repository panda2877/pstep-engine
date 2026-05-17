/**
 * Fastify HTTP 服务器
 * pstep-engine 的主入口
 */

import fastify from 'fastify';
import fastifySseV2 from 'fastify-sse-v2';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from '@fastify/cors';
import { RuleEngine } from '../rules/rule-engine.js';
import { ProjectDao, SessionDao, MessageDao } from '../db/dao.js';
import { createEngine } from '../engine/index.js';
import type { PstepMessage } from '../types/messages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface EngineServerOptions {
  port?: number;
  host?: string;
  gatewayUrl?: string;
}

export function createServer(options: EngineServerOptions = {}) {
  const {
    port = 4000,
    host = '0.0.0.0',
    gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3001',
  } = options;

  const server = fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  const ruleEngine = new RuleEngine();

  server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  server.register(fastifySseV2);

  server.get('/health', async () => {
    return { status: 'ok', version: '0.1.0', timestamp: Date.now() };
  });

  // Project APIs
  server.get('/api/projects', async () => ({ projects: ProjectDao.findAll() }));

  server.post('/api/projects', async (request) => {
    const body = request.body as { name: string; description?: string };
    const project = ProjectDao.create({ name: body.name, description: body.description });
    return { id: project.id, name: project.name, status: 'created' };
  });

  server.get<{ Params: { id: string } }>('/api/projects/:id', async (request) => {
    const project = ProjectDao.findById(request.params.id);
    if (!project) return { id: request.params.id, status: 'not_found' };
    return { ...project, status: 'ok' };
  });

  server.get<{ Params: { id: string } }>('/api/projects/:id/rules', async (request) => {
    const rules = await ruleEngine.getRules(request.params.id);
    return { rules, count: rules.length };
  });

  server.put<{ Params: { id: string } }>('/api/projects/:id/rules', async (request) => {
    const body = request.body as { category: string; content: string; priority?: number; ruleId?: string };
    if (body.ruleId) {
      const updated = await ruleEngine.updateRule(body.ruleId, body.content, body.priority);
      if (!updated) return { status: 'not_found' };
      return { status: 'updated', rule: updated };
    }
    const rule = await ruleEngine.createRule(request.params.id, body.category as any, body.content, body.priority);
    return { status: 'created', rule };
  });

  server.delete<{ Params: { id: string } }>('/api/projects/:id/rules', async (request) => {
    await ruleEngine.deleteRulesByProject(request.params.id);
    return { status: 'deleted' };
  });

  // Session APIs
  server.get('/api/sessions', async (request) => {
    const query = request.query as { projectId?: string };
    if (query.projectId) return { sessions: SessionDao.findByProject(query.projectId) };
    return { sessions: [] };
  });

  server.post('/api/sessions', async (request) => {
    const body = request.body as { projectId: string; title?: string };
    const session = SessionDao.create({ projectId: body.projectId, title: body.title });
    return { id: session.id, projectId: session.projectId, status: 'created' };
  });

  server.get<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    const session = SessionDao.findById(request.params.id);
    if (!session) return { id: request.params.id, status: 'not_found' };
    const messages = MessageDao.findBySession(request.params.id);
    return { ...session, status: 'ok', messages };
  });

  server.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    MessageDao.deleteBySession(request.params.id);
    const deleted = SessionDao.delete(request.params.id);
    return { status: deleted ? 'deleted' : 'not_found' };
  });

  // Chat API
  server.post('/api/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['projectId', 'message'],
        properties: {
          projectId: { type: 'string' },
          sessionId: { type: 'string' },
          message: { type: 'string' },
          stream: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { projectId: string; sessionId?: string; message: string; stream?: boolean };
    const { projectId, sessionId, message, stream = true } = body;

    if (!stream) {
      return { type: 'done', sessionId: sessionId || 'temp', message: 'Non-streaming mode not yet implemented' };
    }

    let actualSessionId = sessionId;
    if (!actualSessionId) {
      // 修复 FK 约束：先检查 project 是否存在，不存在则自动创建
      let project = ProjectDao.findById(projectId);
      if (!project) {
        project = ProjectDao.create({
          name: `Auto-project-${projectId.slice(0, 8)}`,
          description: "Auto-created for session",
        });
      }
      const session = SessionDao.create({ projectId, title: message.slice(0, 50) });
      actualSessionId = session.id;
    }

    const basePrompt = `你是一位专业的 AI 编程助手，采用 Plan/Solve/Verify 范式工作：

1. **Plan（规划）**：分析任务，拆解为结构化步骤
2. **Solve（执行）**：逐步执行每个步骤，调用必要工具
3. **Verify（验证）**：验证每一步的结果，确保质量

请按此流程回答用户问题。`;

    const fullSystemPrompt = await ruleEngine.mergeWithBasePrompt(basePrompt, projectId);

    reply.sse({
      event: 'message',
      data: JSON.stringify({ type: 'plan', content: `正在分析任务：${message}`, steps: [], totalSteps: 0 }),
    });

    const engine = createEngine({ gatewayUrl, systemPrompt: fullSystemPrompt });

    try {
      await engine.initialize();
      for await (const msg of engine.execute(message, projectId, actualSessionId)) {
        const contentStr = typeof msg === 'object' && 'content' in msg ? String((msg as any).content ?? '') : '';
        MessageDao.create({
          sessionId: actualSessionId,
          role: msg.role,
          content: contentStr,
          metadata: JSON.stringify({ type: (msg as any).type }),
        });
        reply.sse({ event: 'message', data: JSON.stringify(msg) });
      }
      reply.sse({
        event: 'done',
        data: JSON.stringify({ type: 'done', sessionId: actualSessionId, messageCount: 1, totalSteps: 0, completedSteps: 0, summary: '引擎已就绪，规则注入完成' }),
      });
    } catch (err) {
      console.error('[Chat] Engine execution error:', err);
      reply.sse({ event: 'error', data: JSON.stringify({ type: 'error', message: 'Engine execution failed' }) });
    }
  });

  const start = async () => {
    try {
      await server.listen({ port, host });
      console.log(`[Server] pstep-engine started on http://${host}:${port}`);
      console.log(`[Server] Gateway URL: ${gatewayUrl}`);
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };

  const stop = async () => {
    await server.close();
    console.log('[Server] pstep-engine stopped');
  };

  return { server, start, stop, port, host };
}
