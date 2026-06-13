import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 开发态来源保护：显式允许本地来源，否则 HMR WebSocket 会被拒，
  // 导致开发态客户端不接管、next/link 降级为整页刷新。
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
