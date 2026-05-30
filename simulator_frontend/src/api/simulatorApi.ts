// src/api/simulatorApi.ts
import axios from 'axios';

const simulatorApi = axios.create({
  baseURL: import.meta.env.VITE_SIMULATOR_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default simulatorApi;