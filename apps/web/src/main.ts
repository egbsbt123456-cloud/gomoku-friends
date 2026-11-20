import {createApp} from 'vue';
import {createRouter,createWebHistory} from 'vue-router';
import App from './App.vue';
import Gomoku from './pages/GomokuPlay.vue';
import './style.css';
const router=createRouter({history:createWebHistory(),routes:[{path:'/',component:Gomoku},{path:'/games/gomoku',component:Gomoku},{path:'/:pathMatch(.*)*',redirect:'/'}]});
createApp(App).use(router).mount('#app');
