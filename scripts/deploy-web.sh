#!/bin/bash

# pstep Web UI 部署脚本
# 用法: ./scripts/deploy-web.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$PROJECT_ROOT/web"
DIST_DIR="$WEB_DIR/dist"

echo "🚀 开始部署 pstep Web UI..."

# 检查 web 目录是否存在
if [ ! -d "$WEB_DIR" ]; then
    echo "❌ 错误: web 目录不存在"
    exit 1
fi

# 进入 web 目录
cd "$WEB_DIR"

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建
echo "🔨 构建生产版本..."
npm run build

# 检查构建产物
if [ ! -d "$DIST_DIR" ]; then
    echo "❌ 错误: 构建失败，dist 目录不存在"
    exit 1
fi

echo "✅ 构建完成！"
echo ""
echo "📁 构建产物位置: $DIST_DIR"
echo ""
echo "📋 部署选项:"
echo "  1. 将 dist/ 目录复制到 Web 服务器"
echo "  2. 使用 nginx 托管静态文件"
echo "  3. 与 pstep-engine 后端集成"
echo ""
echo "💡 提示: 开发模式请运行 'cd web && npm run dev'"
