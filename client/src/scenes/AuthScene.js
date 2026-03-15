import Phaser from "phaser";

const API_URL = "http://localhost:3000";

export default class AuthScene extends Phaser.Scene {
  constructor() {
    super("AuthScene");
  }

  create() {
    this.add
      .text(400, 80, "AI Shooter", {
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const formHtml = `
      <div id="auth-form" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        font-family: Arial, sans-serif;
      ">
        <input id="auth-username" type="text" placeholder="Username" style="
          width: 220px; padding: 10px 14px; border: none; border-radius: 6px;
          background: #16213e; color: #fff; font-size: 16px; outline: none;
        " />
        <input id="auth-password" type="password" placeholder="Password" style="
          width: 220px; padding: 10px 14px; border: none; border-radius: 6px;
          background: #16213e; color: #fff; font-size: 16px; outline: none;
        " />
        <div style="display: flex; gap: 10px;">
          <button id="auth-login" style="
            padding: 10px 24px; border: none; border-radius: 6px;
            background: #0f3460; color: #fff; font-size: 16px; cursor: pointer;
          ">Login</button>
          <button id="auth-register" style="
            padding: 10px 24px; border: none; border-radius: 6px;
            background: #533483; color: #fff; font-size: 16px; cursor: pointer;
          ">Register</button>
        </div>
        <p id="auth-error" style="color: #e94560; font-size: 14px; margin: 0; min-height: 20px;"></p>
      </div>
    `;

    this.formElement = this.add.dom(400, 320).createFromHTML(formHtml);

    this.formElement.addListener("click");
    this.formElement.on("click", (event) => {
      if (event.target.id === "auth-login") {
        this.handleAuth("login");
      } else if (event.target.id === "auth-register") {
        this.handleAuth("register");
      }
    });
  }

  async handleAuth(mode) {
    const username = this.formElement.getChildByID("auth-username").value.trim();
    const password = this.formElement.getChildByID("auth-password").value;
    const errorEl = this.formElement.getChildByID("auth-error");

    if (!username || !password) {
      errorEl.textContent = "Username and password are required";
      return;
    }

    errorEl.textContent = "";

    try {
      const res = await fetch(`${API_URL}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || "Something went wrong";
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("player", JSON.stringify(data.player));
      this.scene.start("MenuScene");
    } catch {
      errorEl.textContent = "Could not connect to server";
    }
  }
}
