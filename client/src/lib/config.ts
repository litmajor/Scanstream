import axios from 'axios';
let frontendConfig: any = null;
export async function loadFrontendConfig() {
  if (frontendConfig) return frontendConfig;
  const res = await axios.get('/config/frontend-config.json');
  frontendConfig = res.data;
  return frontendConfig;
}
