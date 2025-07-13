import 'dotenv/config';
import { sendFirst } from "./ai";
import { AppState } from "./state";
const state = new AppState();
state.email = 'alexandrzezekalo@gmail.com';
state.firstMsg = 'Тестовое сообщение';
sendFirst(state);
