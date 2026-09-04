/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070D",
        ink: "#0B1220",
        surface: "rgba(15, 23, 42, 0.65)",
        primary: "#00BFFF",
        secondary: "#8B5CF6",
        accent: "#BF00FF",
        hi: "#FFFFFF",
        muted: "#94A3B8",
        line: "rgba(0, 191, 255, 0.25)",
        ok: "#10B981",
        warn: "#F59E0B",
        err: "#EF4444",
        crit: "#DC2626",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "metal-grad":
          "linear-gradient(135deg, #0b1220 0%, #1e293b 45%, #0b1220 100%)",
        "brand-grad":
          "linear-gradient(135deg, #00BFFF 0%, #8B5CF6 50%, #BF00FF 100%)",
        "chrome-text":
          "linear-gradient(180deg, #F8FAFC 0%, #CBD5E1 40%, #94A3B8 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,191,255,.18), 0 8px 30px rgba(0,191,255,.08)",
        panel:
          "0 1px 0 rgba(255,255,255,.04) inset, 0 30px 60px -30px rgba(0,0,0,.7)",
      },
      keyframes: {
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: ".6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        sweep: "sweep 6s linear infinite",
        pulseSoft: "pulseSoft 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};