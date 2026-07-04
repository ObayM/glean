import { mount } from 'svelte';
import '../../lib/theme.css';
import './popup.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
