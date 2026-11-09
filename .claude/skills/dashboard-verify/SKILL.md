---
name: dashboard-verify
description: 화면을 바꾼 작업을 마친 뒤, 또는 사용자가 "확인해봐", "화면 봐줘"라고 할 때 무료 도구로 대시보드 화면을 직접 확인하는 순서. 로컬은 Playwright MCP, 로그인된 배포 사이트는 Aside repl. 결과 보고서의 테스트 칸에 쓴다.
---

# 대시보드 화면 확인 (무료 도구만)

결과 보고서의 "테스트 결과"에는 이 순서로 직접 본 것만 적는다. 못 본 항목은 못 봤다고 적는다.

## 쓰는 도구 (무료만)

| 도구 | 쓰는 것 | 쓰지 않는 것 |
| --- | --- | --- |
| Playwright MCP (`mcp__playwright__*`) | 전부 | - |
| Aside MCP | `repl`(직접 조작), `browser_profiles` | `exec`: Aside AI 모델을 불러 비용이 생길 수 있음. `.claude/settings.json`에서 막혀 있다 |

비용이 드는 호출(Anthropic API, 유료 서비스)은 먼저 사용자에게 묻는다.

## 1. 로컬 화면 (Playwright)

1. 개발 서버: `npm run dev`를 백그라운드로 실행하고 `http://localhost:5173` 응답(200)을 기다린다. 이미 떠 있으면 그대로 쓴다.
2. `browser_navigate` → `http://localhost:5173`
3. 로그인 전 화면만 볼 수 있다. 비밀번호·토큰은 입력하지 않는다 (Playwright는 `--isolated`라 로그인이 남지 않는다).
4. 크기 두 가지로 캡처한다 (`browser_resize` → `browser_take_screenshot`):
   - 노트북 1366×800
   - 폰 390×844 (화면을 바꾼 작업일 때만)
5. `browser_console_messages`로 오류를 확인한다. 오류가 있으면 보고서에 그대로 적는다.
6. 확인이 끝나면 개발 서버를 끈다 (직접 띄운 경우만).

MCP 브라우저가 `spawn UNKNOWN`으로 안 뜨면: 이 PC는 Windows 스마트 앱 컨트롤이 켜져 있어 Playwright 전용 크로미움(`chrome.exe`)을 막는다 (2026-11-09 확인). 그래서 `~/.claude.json`의 playwright MCP를 `--browser msedge`로 바꿔 두었다. 그래도 안 뜨면 설정이 `chromium`으로 돌아가지 않았는지 보고, 급하면 CLI로 캡처만 한다 (CLI는 창 없는 headless라 막히지 않는다). 콘솔 오류 확인은 못 하니 보고서에 그렇게 적는다.
```bash
npx -y playwright@1.65.0-alpha-2026-10-30 screenshot --browser chromium \
  --viewport-size "1366,800" --wait-for-timeout 3000 http://localhost:5173 <스크래치패드>/local-laptop.png
npx -y playwright@1.65.0-alpha-2026-10-30 screenshot --browser chromium \
  --viewport-size "390,844" --wait-for-timeout 3000 http://localhost:5173 <스크래치패드>/local-phone.png
```

## 2. 배포 사이트 (Aside repl, 로그인된 상태)

로그인 뒤 화면(주식 탭·일정·관제 등)은 사용자가 Aside 브라우저에 로그인해 둔 프로필로 본다.

1. `browser_profiles`로 프로필을 고른다. `connected: false`뿐이면 사용자에게 Aside 앱을 켜고 https://lee-0011.vercel.app 에 한 번 로그인해 달라고 부탁하고 멈춘다.
2. 처음 쓰기 전에 `aside guide repl`을 읽는다. `repl`로 바뀐 화면의 주소를 새 탭에 열고 캡처한다. 변수는 호출 사이에 남으므로 매번 새 이름을 쓴다. 예:
   ```js
   const stockTab = await openTab('https://lee-0011.vercel.app/investments')
   await sleep(3000)
   await stockTab.setViewportSize({ width: 390, height: 844 })
   await stockTab.screenshot({ path: '<스크래치패드 절대경로>/investments-phone.png' })
   console.log(await stockTab.title())
   await closeTab(stockTab)
   ```
   사용자가 열어 둔 탭은 건드리지 않고, 내가 연 탭만 닫는다.
3. **보기만 한다.** 저장·삭제·결재 버튼은 누르지 않고, 입력란에 쓰지 않는다.
4. 배포 직후라면 Vercel 배포가 끝났는지(새 화면이 보이는지) 먼저 확인한다.

## 3. 보고

- 캡처는 스크래치패드에 두고, Read로 열어 눈으로 확인한 뒤 전체 절대경로로 알려 준다.
- 보고서 "테스트 결과"에 로컬/배포, 노트북/폰을 나눠 적는다.
- 텔레그램·Supabase처럼 여기서 볼 수 없는 것은 `deploy-check` 가이드로 사용자에게 맡긴다.
