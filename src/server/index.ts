/**
 * Fastify HTTP 服务器
 * pstep-engine 的主入口
 */

import fastify from 'fastify';
import fastifySseV2 from 'fastify-sse-v2';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from '@fastify/cors';
import { SseEvent } from '../types/messages.js';

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

  // 注册插件
  server.register(cors, {
    origin: '*', // 生产环境应限制为具体域名
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  server.register(fastifySseV2);

  // ========================================================================
  // 健康检查
  // ========================================================================

  server.get('/health', async () => {
    return {
      status: 'ok',
      version: '0.1.0',
      timestamp: Date.now(),
    };
  });

  // ========================================================================
  // 项目管理
  // ========================================================================

  // GET /api/projects - 获取所有项目
  server.get('/api/projects', async (request, reply) => {
    // TODO: 实现项目列表
    return { projects: [] };
  });

  // POST /api/projects - 创建项目
  server.post('/api/projects', async (request, reply) => {
    const body = request.body as { name: string; description?: string };
    // TODO: 实现项目创建
    return { id: 'temp-id', name: body.name, status: 'created' };
  });

  // GET /api/projects/:id - 获取项目详情
  server.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    // TODO: 实现项目详情
    return { id: request.params.id, status: 'not_found' };
  });

  // GET /api/projects/:id/rules - 获取项目规则
  server.get<{ Params: { id: string } }>('/api/projects/:id/rules', async (request, reply) => {
    // TODO: 实现规则获取
    return { rules: [] };
  });

  // PUT /api/projects/:id/rules - 更新项目规则
  server.put<{ Params: { id: string } }>('/api/projects/:id/rules', async (request, reply) => {
    // TODO: 实现规则更新
    return { status: 'updated' };
  });

  // ========================================================================
  // 会话管理
  // ========================================================================

  // GET /api/sessions - 获取所有会话
  server.get('/api/sessions', async (request, reply) => {
    // TODO: 实现会话列表
    return { sessions: [] };
  });

  // POST /api/sessions - 创建会话
  server.post('/api/sessions', async (request, reply) => {
    const body = request.body as { projectId: string; title?: string };
    // TODO: 实现会话创建
    return { id: 'temp-session-id', projectId: body.projectId, status: 'created' };
  });

  // GET /api/sessions/:id - 获取会话详情
  server.get<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    // TODO: 实现会话详情
    return { id: request.params.id, status: 'not_found' };
  });

  // DELETE /api/sessions/:id - 删除会话
  server.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    // TODO: 实现会话删除
    return { status: 'deleted' };
  });

  // ========================================================================
  // 主聊天接口（SSE 流式响应）
  // ========================================================================

  // POST /api/chat - 发起对话（SSE 流式响应）
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
    const { projectId, sessionId, message, stream = true } = request.body as {
      projectId: string;
      sessionId?: string;
      message: string;
      stream?: boolean;
    };

    if (!stream) {
      // 非流式模式：等待完整响应
      // TODO: 实现非流式响应
      return {
        type: 'done',
        sessionId: sessionId || 'temp',
        message: 'Non-streaming mode not yet implemented',
      };
    }

    // 流式模式：SSE 响应
    // fastify-sse-v2 v4: data must be a string (JSON.stringified)
    reply.sse({
      event: 'message',
      data: JSON.stringify({
        type: 'plan',
        content: `正在分析任务：${message}`,
        steps: [],
        totalSteps: 0,
      }),
    });

    // TODO: 实现完整的 Plan/Solve/Verify 循环
    // 这里只是占位实现

    reply.sse({
      event: 'done',
      data: JSON.stringify({
        type: 'done',
        sessionId: sessionId || 'temp',
        messageCount: 1,
        totalSteps: 0,
        completedSteps: 0,
        summary: '框架已就绪，等待核心循环实现',
      }),
    });
  });

  // ========================================================================
  // 启动服务器
  // ========================================================================

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
