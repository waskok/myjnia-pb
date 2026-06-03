import dotenv from 'dotenv';
import { createApp } from './createApp.js';

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Serwer uruchomiony pod adresem: http://localhost:${PORT}`);
});
