import os

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

URL = os.getenv("APP_URL", "http://127.0.0.1:3001")
TEST_TEXT = "自动化测试消息123"


def find_sender_input(page):
    candidates = [
        page.locator("textarea[placeholder*='请输入内容']").first,
        page.locator(".ant-sender [contenteditable='true']").first,
        page.locator(".ant-sender .ant-sender-input-slot").first,
    ]
    for loc in candidates:
        if loc.count() > 0:
            return loc
    return None


def fill_sender_input(input_locator, text: str):
    tag_name = input_locator.evaluate("el => el.tagName.toLowerCase()")
    editable = input_locator.get_attribute("contenteditable")
    if tag_name == "textarea":
        input_locator.fill(text)
        return

    input_locator.click()
    if editable == "true":
        input_locator.fill(text)
    else:
        input_locator.type(text)


def ensure_dark_mode(page):
    if page.evaluate("document.documentElement.classList.contains('dark')"):
        return

    toggle = page.locator(".theme-toggle").first
    if toggle.count() > 0:
        toggle.click()
        page.wait_for_timeout(300)
        return

    theme_button = page.get_by_role("button", name="theme")
    if theme_button.count() > 0:
        theme_button.first.click()
        page.wait_for_timeout(300)


def run(browser_name: str):
    with sync_playwright() as p:
        browser = None
        last_error = None

        # Prefer system browsers first to avoid heavy playwright browser download.
        launchers = [
            ("msedge", lambda: p.chromium.launch(channel="msedge", headless=True)),
            ("chrome", lambda: p.chromium.launch(channel="chrome", headless=True)),
            ("chromium", lambda: p.chromium.launch(headless=True)),
        ]

        for name, launcher in launchers:
            try:
                browser = launcher()
                print(f"[ok] launched via {name}")
                break
            except Exception as exc:
                last_error = exc
                print(f"[warn] launch {name} failed: {exc}")

        if browser is None:
            raise RuntimeError(f"No browser launcher available: {last_error}")

        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda msg: print(f"[console:{msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: print(f"[pageerror] {exc}"))

        try:
            page.goto(URL, wait_until="domcontentloaded", timeout=30000)
            # Next.js dev mode keeps HMR/websocket connections alive; don't block on networkidle.
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeoutError:
                page.wait_for_timeout(300)

            ensure_dark_mode(page)

            is_dark = page.evaluate("document.documentElement.classList.contains('dark')")
            print(f"[info] dark mode: {is_dark}")

            sender_input = find_sender_input(page)
            if sender_input is None:
                page.screenshot(path="ui-check-no-input.png", full_page=True)
                body_text = page.locator("body").inner_text()
                html = page.content()
                print(f"[debug] body preview: {body_text[:500]}")
                print(f"[debug] .ant-sender count: {page.locator('.ant-sender').count()}")
                print(f"[debug] textarea count: {page.locator('textarea').count()}")
                print(f"[debug] contenteditable count: {page.locator('[contenteditable=true]').count()}")
                print(f"[debug] role textbox count: {page.get_by_role('textbox').count()}")
                print(f"[debug] has Deep Thinking text: {'Deep Thinking' in body_text}")
                print(f"[debug] has ChatSender placeholder: {'请输入内容，回车发送' in html}")
                print(f"[debug] has min-height 56 fallback: {'min-height: 56px' in html}")
                raise RuntimeError("sender input not found")

            sender_input.wait_for(timeout=10000)
            fill_sender_input(sender_input, TEST_TEXT)

            send_btn = page.locator(".ant-sender .ant-btn-primary").last
            send_btn.wait_for(timeout=10000)
            disabled = send_btn.get_attribute("disabled")
            print(f"[info] send button disabled attr: {disabled}")

            send_btn.click(timeout=10000)

            page.wait_for_timeout(250)
            page.wait_for_selector(f"text={TEST_TEXT}", timeout=10000)

            # Send additional messages to create enough content for scroll testing.
            for idx in range(1, 8):
                fill_sender_input(sender_input, f"{TEST_TEXT}-{idx}")
                page.locator(".ant-sender .ant-btn-primary").last.click(timeout=10000)
                page.wait_for_timeout(100)

            scroll_info = page.evaluate(
                """
                () => {
                    const el = document.querySelector('.conversation-scroll-area');
                    if (!el) return null;
                    const style = window.getComputedStyle(el);
                    const thumbColor = getComputedStyle(document.documentElement).getPropertyValue('--app-send-btn-bg');
                    return {
                        exists: true,
                        overflowY: style.overflowY,
                        scrollHeight: el.scrollHeight,
                        clientHeight: el.clientHeight,
                        scrollTop: el.scrollTop,
                        themeVarSendBg: thumbColor.trim(),
                    };
                }
                """
            )
            print(f"[info] conversation scroll info: {scroll_info}")

            page.screenshot(path="ui-check-dark.png", full_page=True)
            print("[ok] screenshot saved: ui-check-dark.png")

        except PlaywrightTimeoutError as exc:
            print(f"[error] timeout: {exc}")
            page.screenshot(path="ui-check-timeout.png", full_page=True)
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    run("auto")
