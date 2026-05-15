function DesktopApp() {
  const { useState, useEffect } = React;
  const [screen, setScreen] = useState("login");

  // Theme: system | light | dark — defaults to system, persisted to localStorage.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("pc2cloud_theme") || "system"; } catch { return "system"; }
  });

  useEffect(() => {
    try { localStorage.setItem("pc2cloud_theme", theme); } catch {}
    const apply = () => {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = theme === "dark" || (theme === "system" && sysDark);
      document.documentElement.classList.toggle("dark", isDark);
    };
    apply();
    if (theme === "system") {
      const m = window.matchMedia("(prefers-color-scheme: dark)");
      m.addEventListener("change", apply);
      return () => m.removeEventListener("change", apply);
    }
  }, [theme]);

  // One button — cycles system → light → dark → system
  function cycleTheme() {
    setTheme((t) => t === "system" ? "light" : t === "light" ? "dark" : "system");
  }
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <Frame theme={theme} isDark={isDark} onCycleTheme={cycleTheme}>
      {screen === "login" && <DesktopLogin onDone={() => setScreen("setup")} />}
      {screen === "setup" && <DesktopSetup onDone={() => setScreen("ready")} onLogout={() => setScreen("login")} />}
      {screen === "ready" && <DesktopReady onDisconnect={() => setScreen("login")} />}
    </Frame>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<DesktopApp />);
