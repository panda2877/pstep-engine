# pstep-engine 部署指南

## 方式 1：pm2（推荐）

### 安装

```bash
npm install -g pm2
cd pstep-engine
npm run build
```

### 创建 ecosystem.config.js

```js
module.exports = {
  apps: [{
    name: 'pstep-engine',
    script: './dist/app.js',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      GATEWAY_URL: 'http://134.175.163.213:3001/v1/messages',
      PSTEP_DB_PATH: '/opt/pstep/data/pstep.db',
      // 飞书
      FEISHU_APP_ID: 'cli_xxxxxxxx',
      FEISHU_APP_SECRET: 'your_app_secret_here',
      FEISHU_GROUP_MENTION_REQUIRED: 'true',
      FEISHU_CARD_FLUSH_MS: '200',
    },
    // 日志
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/pstep-engine/error.log',
    out_file: '/var/log/pstep-engine/out.log',
    merge_logs: true,
    // 性能
    max_memory_restart: '500M',
    restart_delay: 5000,
    max_restarts: 10,
  }]
};
```

### 启动

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # 开机自启
```

### 监控

```bash
pm2 logs pstep-engine         # 实时日志
pm2 monit                      # 仪表盘
pm2 describe pstep-engine      # 进程详情
```

---

## 方式 2：systemd

### 创建 /etc/systemd/system/pstep-engine.service

```ini
[Unit]
Description=Pstep Engine Agent Service
After=network.target

[Service]
Type=simple
User=pstep
Group=pstep
WorkingDirectory=/opt/pstep
ExecStart=/usr/bin/node /opt/pstep/dist/app.js
Restart=on-failure
RestartSec=10

# 环境变量
Environment=NODE_ENV=production
Environment=GATEWAY_URL=http://134.175.163.213:3001/v1/messages
Environment=PSTEP_DB_PATH=/opt/pstep/data/pstep.db
Environment=FEISHU_APP_ID=cli_xxxxxxxx
Environment=FEISHU_APP_SECRET=your_app_secret_here
EnvironmentFile=-/opt/pstep/.env

StandardOutput=journal
StandardError=journal
SyslogIdentifier=pstep-engine

# 安全
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/pstep/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 创建 .env（敏感配置）

```bash
cat > /opt/pstep/.env << 'EOF'
FEISHU_APP_SECRET=your_app_secret_here
EOF
chmod 600 /opt/pstep/.env
```

### 启动

```bash
sudo systemctl daemon-reload
sudo systemctl enable pstep-engine
sudo systemctl start pstep-engine
sudo journalctl -u pstep-engine -f   # 查看日志
```

---

## 方式 3：Docker（参考）

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# SQLite 数据持久化
RUN mkdir -p /app/data
VOLUME /app/data

ENV PSTEP_DB_PATH=/app/data/pstep.db
EXPOSE 4000

CMD ["node", "dist/app.js"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  pstep-engine:
    build: .
    ports:
      - "4000:4000"
    environment:
      - GATEWAY_URL=http://host.docker.internal:3001/v1/messages
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
      - FEISHU_GROUP_MENTION_REQUIRED=true
      - PSTEP_DB_PATH=/app/data/pstep.db
    volumes:
      - pstep-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:4000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  pstep-data:
```

### 运行

```bash
docker compose up -d
docker compose logs -f pstep-engine
```

---

## 监控

### 健康检查端点

```bash
curl http://localhost:4000/health
# {"status":"ok","version":"0.1.0","timestamp":1782050055219}
```

### 日志关键行

```
[PstepEngine] Engine initialized with Phase 2 core loop     # 引擎初始化
[Feishu] channel up                                          # 飞书连接建立
[Server] pstep-engine started on http://0.0.0.0:4000         # HTTP 服务启动
[feishu:streamer] PATCH failed code=230020 msg=rate limit    # 限流（正常退避）
[feishu:router] engine error chat=oc_xxx msg=m_xxx           # 引擎执行失败
```

### 告警建议

| 日志 | 含义 | 处理 |
|------|------|------|
| `failed to resolve bot identity` | bot 身份解析失败（scope 不足） | 检查权限申请 |
| `router handle threw` | 入站消息处理异常 | 查看完整堆栈 |
| 连续 `PATCH failed code=230020` | 飞书限流 | 检查 `FEISHU_CARD_FLUSH_MS`，建议调大 |
| `[Server] engine.initialize() failed` | LLM 网关不可达 | 检查 `GATEWAY_URL` |

---

## 飞书权限申请清单

| 权限 scope | 用途 | 申请位置 |
|---|---|---|
| `im:message.group_at_msg:readonly` | 接收群聊 @bot 消息 | 应用 → 权限管理 |
| `im:message.p2p_msg:readonly` | 接收私聊消息 | 应用 → 权限管理 |
| `im:message:send_as_bot` | 发送消息（旧） | 应用 → 权限管理 |
| `im:message:send` | 发送消息（新） | 应用 → 权限管理 |
| `im:message:update` | 更新已发消息（卡片 PATCH） | 应用 → 权限管理 |

**注意**：权限申请后需要管理员审批，通常需要 1-2 个工作日。
