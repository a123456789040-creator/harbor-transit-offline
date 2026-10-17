const toggle=document.getElementById('dispatch-toggle'),app=document.querySelector('.app');
if(toggle)toggle.addEventListener('click',()=>{
  const collapsed=app.classList.toggle('dispatch-collapsed');
  toggle.setAttribute('aria-expanded',String(!collapsed));toggle.textContent=collapsed?'顯示調度':'收起調度';
});
