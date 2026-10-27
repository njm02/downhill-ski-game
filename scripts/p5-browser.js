// Live Server serves raw modules; p5 publishes a browser global rather than an
// ES-module default export. Vite continues resolving its normal npm dependency.
import '../node_modules/p5/lib/p5.min.js';
export default globalThis.p5;
