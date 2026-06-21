# pstep-engine 部署手册

**目标服务器**: `134.175.163.213`（与 pstep-gateway 同机）  
**端口**: `4000`（直连，不走 nginx 反代——飞书 WSClient 是出站长连接，无需公网入站）  
**进程管理**: systemd（与 pstep-gateway 一致）

---

## 1. 服务器目录结构

```
/opt/pstep/engine/              # 代码 + node_modules + dist
├── src/                        # 源码
├── dist/                       # tsc 编译产物
├── node_modules/
├── package.json
└── package-lock.json

/var/lib/pstep-engine/          # 运行时数据
├── data/
│   └── pstep.db                # SQLite 数据库（WAL 模式）
└── logs/                       # 应用日志（备选，systemd journal 默认已管）

/etc/pstep-engine/              # 敏感配置
└── env                         # EnvironmentFile（mode 0600）
```

---

## 2. 初次部署

### 2.1 创建目录

```bash
ssh root@134.175.163.213

# 代码目录
sudo mkdir -p /opt/pstep/engine
sudo chown root:root /opt/pstep/engine

# 数据目录
sudo mkdir -p /var/lib/pstep-engine/data
sudo chown root:root /var/lib/pstep-engine

# 敏感配置目录
sudo mkdir -p /etc/pstep-engine
sudo touch /etc/pstep-engine/env
sudo chmod 600 /etc/pstep-engine/env
sudo chown root:root /etc/pstep-engine/env
```

### 2.2 写入环境变量

```bash
sudo tee /etc/pstep-engine/env << 'EOF'
# LLM 网关（pstep-gateway 本机，nginx 转发到 3002）
GATEWAY_URL=http://127.0.0.1:3002

# 飞书渠道
FEISHU_APP_ID=cli_xxxxxxxx
FEISHU_APP_SECRET=your_app_secret_here
FEISHU_GROUP_MENTION_REQUIRED=true
FEISHU_CARD_FLUSH_MS=200
FEISHU_CARD_MAX_BYTES=25000

# 数据库
PSTEP_DB_PATH=/var/lib/pstep-engine/data/pstep.db

# 调试（生产可设 false）
FEISHU_DEBUG=false
NODE_ENV=production
EOF

sudo chmod 600 /etc/pstep-engine/env
```

### 2.3 上传代码

```bash
# 从本地开发机
cd /root/repo/pstep-engine
npm run build
tar czf /tmp/pstep-engine.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  -C /root/repo pstep-engine

scp /tmp/pstep-engine.tar.gz root@134.175.163.213:/tmp/
```

### 2.4 服务器上安装

```bash
ssh root@134.175.163.213

# 解压
sudo rm -rf /opt/pstep/engine
sudo mkdir -p /opt/pstep/engine
sudo tar xzf /tmp/pstep-engine.tar.gz -C /opt/pstep/
sudo mv /opt/pstep/pstep-engine/* /opt/pstep/engine/
sudo rmdir /opt/pstep/pstep-engine

# 安装依赖
cd /opt/pstep/engine
sudo npm install --production --no-audit

# 编译
sudo npm run build

# 验证
node dist/app.js --help  # 应该能看到启动日志
```

### 2.5 创建 systemd 服务

```bash
sudo tee /etc/systemd/system/pstep-engine.service << 'UNIT'
[Unit]
Description=Pstep Engine Agent Service
After=network.target
# 如果 gateway 先启动，engine 的 GATEWAY_URL 才可达
After=pstep-gateway-a.service
Wants=pstep-gateway-a.service

[Service]
Type=simple
WorkingDirectory=/opt/pstep/engine
ExecStart=/usr/bin/node dist/app.js
Restart=on-failure
RestartSec=10
EnvironmentFile=/etc/pstep-engine/env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pstep-engine

# 安全加固
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/pstep-engine
PrivateTmp=true
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable pstep-engine
sudo systemctl start pstep-engine
```

### 2.6 验证

```bash
# 查看启动日志
sudo journalctl -u pstep-engine -f --no-pager -n 20

# 期望看到:
# [PstepEngine] Engine initialized with Phase 2 core loop
# [Feishu] channel up (group mention required: true, flush 200ms)
# [Server] pstep-engine started on http://0.0.0.0:4000

# 健康检查
curl http://127.0.0.1:4000/health
# {"status":"ok","version":"0.1.0","timestamp":...}

# 飞书测试：在飞书私聊 bot 发一条消息，验证流式卡片响应
```

---

## 3. 日常更新部署

### 方式 A：CI 自动部署（推荐）

推代码到 main 分支，GitHub Actions 自动编译 + scp + 重启。

触发条件（`src/**`, `package.json`, `tsconfig.json` 变化）。

### 方式 B：手动部署

```bash
# 1. 本地编译
cd /root/repo/pstep-engine
git pull origin restore/full-server
npm install --production --no-audit
npm run build

# 2. 打包上传
tar czf /tmp/pstep-engine.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  -C /root/repo pstep-engine
scp /tmp/pstep-engine.tar.gz root@134.175.163.213:/tmp/

# 3. 服务器上替换
ssh root@134.175.163.213
sudo systemctl stop pstep-engine
sudo rm -rf /opt/pstep/engine/src /opt/pstep/engine/dist
sudo tar xzf /tmp/pstep-engine.tar.gz -C /opt/pstep/
sudo mv /opt/pstep/pstep-engine/src /opt/pstep/engine/
sudo mv /opt/pstep/pstep-engine/dist /opt/pstep/engine/
# 如果 package.json 有变化：
cd /opt/pstep/engine && sudo npm install --production --no-audit
sudo systemctl start pstep-engine

# 4. 验证
curl http://127.0.0.1:4000/health
```

---

## 4. 回滚

```bash
ssh root@134.175.163.213

# 停服务
sudo systemctl stop pstep-engine

# 找到上一个 git commit 的 dist/
cd /opt/pstep/engine
git log --oneline -5   # 找目标 commit
git checkout <commit-sha> -- src/ package.json package-lock.json tsconfig.json
sudo npm install --production --no-audit
sudo npm run build

# 重启
sudo systemctl start pstep-engine
curl http://127.0.0.1:4000/health
```

---

## 5. 故障排查

### 5.1 服务启动失败

```bash
sudo journalctl -u pstep-engine -n 50 --no-pager

# 常见原因：
# - FEISHU_APP_ID / FEISHU_APP_SECRET 未设置 → "channel skipped"（正常，不是错误）
# - GATEWAY_URL 不可达 → engine.initialize() failed → 重启后首次 /api/chat 会重试
# - 端口被占用 → Error: listen EADDRINUSE :::4000
```

### 5.2 飞书消息无响应

```bash
# 检查飞书连接状态
sudo journalctl -u pstep-engine | grep feishu

# 如果看到 "invalid appId" → 检查 FEISHU_APP_ID 是否正确
# 如果看到 "failed to obtain token" → 检查 FEISHU_APP_SECRET 是否正确
# 如果看到 "channel up" 但消息不响应 → 检查权限是否审批通过
```

### 5.3 LLM 网关不可达

```bash
# 验证网关
curl http://127.0.0.1:3002/health
# 应返回 pstep-gateway 的 health JSON

# 如果网关没跑：
sudo systemctl status pstep-gateway-a
sudo systemctl status pstep-gateway-b
```

### 5.4 SQLite 锁

```bash
# 如果看到 "database is locked"
# 1. 确认只有一个 pstep-engine 实例在跑
ps aux | grep "node dist/app.js" | grep -v grep

# 2. 检查 WAL 文件大小
ls -la /var/lib/pstep-engine/data/

# 3. 必要时重启
sudo systemctl restart pstep-engine
```

---

## 6. 与 pstep-gateway 的关系

```
飞书用户 → [飞书云] → (WSClient 出站) → [pstep-engine:4000]
                                              ↓
                                              GATEWAY_URL=http://127.0.0.1:3002
                                              ↓
                                        [nginx:3002] → [pstep-gateway-a/b:13004/13005]
                                              ↓
                                        [上游 LLM (OpenAI/Anthropic/MiniMax)]
```

pstep-engine 是 pstep-gateway 的**下游消费者**。它通过 `GATEWAY_URL=http://127.0.0.1:3002` 调用网关的 OpenAI 兼容接口。

---

## 7. 端口分配总览

```
0.0.0.0:80      nginx（公网入口）
0.0.0.0:3002    nginx → pstep-gateway（OpenAI 兼容 LLM 代理）
0.0.0.0:3003    nginx → pstep-admin（管理后台前端）
127.0.0.1:13004 pstep-gateway-a 容器（slot A，仅本机）
127.0.0.1:13005 pstep-gateway-b 容器（slot B，仅本机）
0.0.0.0:4000    pstep-engine（Agent 引擎 + 飞书渠道，公网直连）
```

> port 4000 对公网开放——飞书 WSClient 是出站连接，不需要公网入站。但端口 4000 仍绑定 `0.0.0.0`（Fastify 默认），如需限制只允许本机访问，可改 Fastify 的 `host` 为 `127.0.0.1`。
