var nav = document.getElementById('nav');
var height = window.getComputedStyle(nav).height;
window.navHeight = Number(height.split('px')[0]);
console.log('height.js executied');
