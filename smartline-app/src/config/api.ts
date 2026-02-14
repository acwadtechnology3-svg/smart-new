import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost?.split(':')[0];

export const API_URL = process.env.EXPO_PUBLIC_API_URL || (localhost
    ? `http://${localhost}:3000/api`
    : 'http://10.0.2.2:3000/api');

console.log('API config - Debugger Host:', debuggerHost);
console.log('API config - Localhost IP:', localhost);
console.log('API config - Using API URL:', API_URL);

