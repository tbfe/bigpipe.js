var nav = window.getElementById('nav');
var height = window.getComputedStyle(nav).height;
window.navHeight = Number(height.split('px')[0]);
