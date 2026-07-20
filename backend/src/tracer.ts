import tracer from 'dd-trace';

tracer.init({
  service: 'ujamaa-api',
  env: process.env.NODE_ENV ?? 'development',
  hostname: process.env.DD_AGENT_HOST ?? 'localhost',
  port: 8126,
  logInjection: true,
  runtimeMetrics: true,
});

export default tracer;
