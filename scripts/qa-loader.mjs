import subprocess, os, time, json, urllib.request, asyncio, base64

CHROME = os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright\chromium-1234\chrome-win64\chrome.exe")
APP_PORT = 18758
DBG = 9363

proc = subprocess.Popen([
    CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
    "--autoplay-policy=no-user-gesture-required",
    f"--remote-debugging-port={DBG}", "--window-size=1600,900",
    f"http://localhost:{APP_PORT}/preview.html#preview-slow"
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2.5)

tabs = json.loads(urllib.request.urlopen(f"http://localhost:{DBG}/json").read())
page = next(t for t in tabs if "preview" in t.get("url", "") and t.get("webSocketDebuggerUrl"))
ws = page["webSocketDebuggerUrl"]

PROBE = """(() => {
  const v = document.querySelector('.skin-video');
  const l = document.querySelector('.stage-loader');
  return { modal: !!document.querySelector('.skin-modal'),
           loading: l ? l.classList.contains('visible') : 'no-el',
           ready: v ? v.readyState : 'no-video', paused: v ? v.paused : null };
})()"""

async def session():
    import websockets
    async with websockets.connect(ws, max_size=20 * 1024 * 1024) as conn:
        mid = [0]
        async def call(method, params=None):
            mid[0] += 1
            await conn.send(json.dumps({"id": mid[0], "method": method, "params": params or {}}))
            while True:
                msg = json.loads(await conn.recv())
                if msg.get("id") == mid[0]:
                    return msg.get("result", {})
        async def ev(expr):
            r = await call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
            return r.get("result", {}).get("value")
        async def shot(name):
            s = await call("Page.captureScreenshot", {"format": "png"})
            with open(rf"C:\Users\rifat\vlr-tui\{name}.png", "wb") as f:
                f.write(base64.b64decode(s["data"]))

        await call("Network.enable")
        await call("Network.emulateNetworkConditions",
                   {"offline": False, "latency": 1200, "downloadThroughput": 45 * 1024, "uploadThroughput": 40 * 1024})
        await call("Page.reload")
        seen = []
        for i in range(12):
            await asyncio.sleep(1.2)
            state = await ev(PROBE)
            seen.append((round((i + 1) * 1.2, 1), state))
            if isinstance(state, dict) and state.get("loading") is True:
                await shot("shot-loader-live")
                break
        for t, s in seen:
            print(f"t={t}s →", s)
        await call("Network.emulateNetworkConditions",
                   {"offline": False, "latency": 0, "downloadThroughput": -1, "uploadThroughput": -1})
        await asyncio.sleep(4)
        print("after unthrottle →", await ev(PROBE))
        await shot("shot-loader-late")

asyncio.run(session())
proc.kill()
print("QA done")
