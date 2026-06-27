/**
 * Fastify HTTP 服务器
 * pstep-engine 的主入口
 */

import fastify from 'fastify';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { RuleEngine } from '../rules/rule-engine.js';
import { ProjectDao, SessionDao, MessageDao, AgentDao } from '../db/dao.js';
import { createEngine } from '../engine/index.js';
import type { PstepMessage } from '../types/messages.js';
import type { HistoryEntry } from '../agent/orchestrator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface EngineServerOptions {
  port?: number;
  host?: string;
  gatewayUrl?: string;
  /** 加载指定会话的历史消息 */
  loadHistory?: (sessionId: string) => Promise<HistoryEntry[]>;
  /** 保存本次执行产生的新消息 */
  saveMessages?: (sessionId: string, entries: HistoryEntry[]) => Promise<void>;
}

export function createServer(options: EngineServerOptions = {}) {
  const {
    port = parseInt(process.env.PORT || '3005', 10),
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

  // 生产模式下托管前端静态文件
  const webDistPath = resolve(__dirname, '../../web/dist');
  const serveWebUI = existsSync(webDistPath);
  if (serveWebUI) {
    server.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });
    console.log(`[Server] Serving web UI from ${webDistPath}`);
  }

  const engine = createEngine({
    gatewayUrl,
    systemPrompt: '',
    loadHistory: options.loadHistory,
    saveMessages: options.saveMessages,
  });
  // Eagerly initialize the shared engine so channels (e.g. Feishu) can
  // dispatch user messages without paying the cold-start cost per turn.
  // Failures are non-fatal: HTTP /api/chat will retry on first request.
  engine.initialize().catch((err) => {
    console.error('[Server] engine.initialize() failed (will retry on first /api/chat):', err);
  });

  server.get('/health', async () => {
    return { status: 'ok', version: '0.1.0', timestamp: Date.now() };
  });

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

  // ============================================================================
  // Agent API
  // ============================================================================

  server.get('/api/agents', async () => ({ agents: AgentDao.findAll() }));

  server.post('/api/agents', async (request) => {
    const body = request.body as { name: string; avatar?: string; initial?: string; description?: string; soul: any };
    const agent = AgentDao.create({
      name: body.name,
      avatar: body.avatar,
      initial: body.initial,
      description: body.description,
      soul: body.soul,
      status: 'active',
    });
    return { id: agent.id, status: 'created' };
  });

  server.get<{ Params: { id: string } }>('/api/agents/:id', async (request) => {
    const agent = AgentDao.findById(request.params.id);
    if (!agent) return { id: request.params.id, status: 'not_found' };
    return { ...agent, status: 'ok' };
  });

  server.put<{ Params: { id: string } }>('/api/agents/:id', async (request) => {
    const body = request.body as { name?: string; avatar?: string; initial?: string; description?: string; soul?: any; status?: 'active' | 'inactive' };
    const agent = AgentDao.update(request.params.id, body);
    if (!agent) return { id: request.params.id, status: 'not_found' };
    return { ...agent, status: 'updated' };
  });

  server.delete<{ Params: { id: string } }>('/api/agents/:id', async (request) => {
    const deleted = AgentDao.delete(request.params.id);
    return { status: deleted ? 'deleted' : 'not_found' };
  });

  server.get<{ Params: { id: string } }>('/api/agents/:id/sessions', async (request) => {
    const sessions = SessionDao.findByAgent(request.params.id);
    return { sessions };
  });

  server.get('/api/sessions', async (request) => {
    const query = request.query as { projectId?: string; agentId?: string };
    if (query.agentId) return { sessions: SessionDao.findByAgent(query.agentId) };
    if (query.projectId) return { sessions: SessionDao.findByProject(query.projectId) };
    return { sessions: [] };
  });

  server.post('/api/sessions', async (request) => {
    const body = request.body as { projectId: string; agentId?: string; title?: string };
    const session = SessionDao.create({ projectId: body.projectId, agentId: body.agentId, title: body.title });
    return { id: session.id, projectId: session.projectId, agentId: session.agentId, status: 'created' };
  });

  server.get<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    const session = SessionDao.findById(request.params.id);
    if (!session) return { id: request.params.id, status: 'not_found' };
    const messages = MessageDao.findBySession(request.params.id);
    const agent = session.agentId ? AgentDao.findById(session.agentId) : null;
    return { ...session, agent, status: 'ok', messages };
  });

  server.put<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    const body = request.body as { title?: string };
    const session = SessionDao.update(request.params.id, body);
    if (!session) return { id: request.params.id, status: 'not_found' };
    return { ...session, status: 'updated' };
  });

  server.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request) => {
    MessageDao.deleteBySession(request.params.id);
    const deleted = SessionDao.delete(request.params.id);
    return { status: deleted ? 'deleted' : 'not_found' };
  });

  // ============================================================================
  // Message Search API
  // ============================================================================

  server.get('/api/messages/search', async (request) => {
    const query = request.query as { q?: string; projectId?: string };
    if (!query.q || query.q.trim().length === 0) {
      return { results: [], total: 0 };
    }
    const results = MessageDao.search(query.q.trim(), query.projectId);
    return { results, total: results.length };
  });

  function rawSse(reply: any, event: string, data: string) {
    const payload = `event: ${event}\ndata: ${data}\n\n`;
    reply.raw.write(payload);
  }

  server.post('/api/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['projectId', 'message'],
        properties: {
          projectId: { type: 'string' },
          agentId: { type: 'string' },
          sessionId: { type: 'string' },
          message: { type: 'string' },
          stream: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { projectId: string; agentId?: string; sessionId?: string; message: string; stream?: boolean };
    const { projectId, agentId, sessionId, message, stream = true } = body;

    if (!stream) {
      return { type: 'done', sessionId: sessionId || 'temp', message: 'Non-streaming mode not yet implemented' };
    }

    let actualSessionId = sessionId;
    if (!actualSessionId) {
      let project = ProjectDao.findById(projectId);
      if (!project) {
        project = ProjectDao.create({
          name: `Auto-project-${projectId.slice(0, 8)}`,
          description: "Auto-created for session",
        });
      }
      const session = SessionDao.create({ projectId: project.id, agentId, title: message.slice(0, 50) });
      actualSessionId = session.id;
    }

    const basePrompt = `你是一位专业的 AI 编程助手，采用 Plan/Solve/Verify 范式工作：

1. **Plan（规划）**：分析任务，拆解为结构化步骤
2. **Solve（执行）**：逐步执行每个步骤，调用必要工具
3. **Verify（验证）**：验证每一步的结果，确保质量

请按此流程回答用户问题。`;

    const fullSystemPrompt = await ruleEngine.mergeWithBasePrompt(basePrompt, projectId);

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('retry: 3000\n\n');

    rawSse(reply, 'message', JSON.stringify({ type: 'plan', content: `正在分析任务：${message}`, steps: [], totalSteps: 0 }));

    try {
      // engine is initialized at server boot; this is a defensive no-op in
      // case the eager init failed earlier.
      await engine.initialize();
      // 消息持久化由 orchestrator.saveMessages 在引擎结束后统一处理，
      // 此处只做 SSE 转发，避免每条 streaming chunk 都写入 DB 导致重复。
      for await (const msg of engine.execute(message, projectId, actualSessionId)) {
        rawSse(reply, 'message', JSON.stringify(msg));
      }
      rawSse(reply, 'done', JSON.stringify({ type: 'done', sessionId: actualSessionId, messageCount: 1, totalSteps: 0, completedSteps: 0, summary: '引擎已就绪，规则注入完成' }));
    } catch (err) {
      console.error('[Chat] Engine execution error:', err);
      rawSse(reply, 'error', JSON.stringify({ type: 'error', message: 'Engine execution failed' }));
    }

    reply.raw.end();
  });

  // SPA fallback: 非 API 路由都返回 index.html
  if (serveWebUI) {
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url === '/health') {
        reply.code(404).send({ status: 'not_found' });
        return;
      }
      reply.type('text/html').sendFile('index.html');
    });
  }

  const start = async () => {
    try {
      await server.listen({ port, host });
      console.log(`[Server] pstep-engine started on http://${host}:${port}`);
      console.log(`[Server] Gateway URL: ${gatewayUrl}`);
      if (serveWebUI) {
        console.log(`[Server] Web UI available at http://${host}:${port}`);
      }
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };

  const stop = async () => {
    await server.close();
    console.log('[Server] pstep-engine stopped');
  };

  return { server, start, stop, port, host, engine };
}
