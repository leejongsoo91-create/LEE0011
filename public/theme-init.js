// 화면이 그려지기 전에 밝은 테마를 적용한다 (깜빡임 방지).
// 보안 헤더(CSP)가 페이지 안 인라인 스크립트를 막으므로 index.html에서 파일로 뺐다 (보고서 10).
try {
  if (localStorage.getItem('theme') === 'light') document.documentElement.classList.remove('dark')
} catch (e) {}
