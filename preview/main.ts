import { mount } from 'svelte';
import '../src/routes/layout.css';
import Preview from './Preview.svelte';
mount(Preview, { target: document.getElementById('app')! });
