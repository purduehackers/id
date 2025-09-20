import type { Config } from "tailwindcss";

const config: Config = {
  content: {
    relative: true,
    files: ["*.html", "./src/**/*.rs"],
    transform: {
      rs: (content) => content.replace(/(?:^|\s)class:/g, " "),
    },
  },
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        blocks: "8px 8px",
        "blocks-md": "6px 6px",
        "blocks-sm": "4px 4px",
        "blocks-tiny": "2px 2px",
        email: "6px 6px",
        "footer-btn": "0px 6px",
        "email-btn": "2px 3px",
      },
      fontFamily: {
        main: "var(--font-space-grotesk)",
        mono: "var(--font-space-mono)",
      },
    },
  },
  plugins: [],
};
export default config;
