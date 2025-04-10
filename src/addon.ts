import ZoteroToolkit from "zotero-plugin-toolkit/dist/index";
import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import hooks from "./hooks";

class Addon {
  public data: {
    alive: boolean;
    env: "development" | "production";
    ztoolkit: ZoteroToolkit;
    locale?: {
      stringBundle: any;
    };
    prefs?: {
      window: Window;
      columns: Array<ColumnOptions>;
      rows: Array<{ [dataKey: string]: string }>;
    };
    grok3ApiKey?: string;
  };
  public hooks: typeof hooks;
  public api: {};

  constructor() {
    this.data = {
      alive: true,
      env: __env__,
      ztoolkit: new ZoteroToolkit(),
      grok3ApiKey: Zotero.Prefs.get("extensions.zotero-grok3.apikey") as string || "",
    };
    this.hooks = hooks;
    this.api = {};
  }

  // 调用 Grok 3 API 的方法（根据官方文档修改）
  async callGrok3API(userPrompt: string, systemPrompt: string = "You are a research assistant."): Promise<string> {
    if (!this.data.grok3ApiKey) {
      throw new Error("Grok 3 API Key is not set. Please configure it in the plugin settings.");
    }

    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.data.grok3ApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          model: "grok-3-latest",
          stream: false,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Grok 3 API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) {
        throw new Error("No reply content found in API response.");
      }

      return reply;
    } catch (error) {
      console.error("Error calling Grok 3 API:", error);
      throw error;
    }
  }

  // 处理 Zotero 文献并调用 Grok 3 API（根据官方文档调整）
  async processItem(item: any) {
    try {
      const abstract = item.getField("abstractNote");
      if (!abstract) {
        ZoteroPane.getNotifier().show("No abstract found", "warning");
        return;
      }

      const userPrompt = `请总结这篇摘要：${abstract}`;
      const systemPrompt = "You are a research assistant specializing in summarizing academic abstracts.";
      const result = await this.callGrok3API(userPrompt, systemPrompt);
      console.log("Grok 3 API response:", result);

      const note = new Zotero.Item("note");
      note.setNote(`Grok 3 Summary: ${result}`);
      note.parentID = item.id;
      await note.saveTx();

      ZoteroPane.getNotifier().show("Summary generated successfully", "success");
    } catch (error) {
      console.error("Failed to process item:", error);
      ZoteroPane.getNotifier().show(`Error: ${error.message}`, "error");
    }
  }

  // 注册菜单项
  registerMenu() {
    const menu = this.data.ztoolkit.Menu;
    menu.register("item", {
      id: "call-grok3-api",
      label: "Summarize with Grok 3",
      onClick: async () => {
        if (!this.data.grok3ApiKey) {
          await this.promptForApiKey();
        }
        if (!this.data.grok3ApiKey) {
          console.log("API Key not provided. Aborting.");
          return;
        }
        const selectedItems = ZoteroPane.getSelectedItems();
        if (selectedItems.length > 0) {
          await this.processItem(selectedItems[0]);
        } else {
          console.log("No items selected.");
        }
      },
    });
  }

  // 提示用户输入 API Key
  async promptForApiKey() {
    const prompt = this.data.ztoolkit.Prompt;
    const input = await prompt.input({
      title: "Grok 3 API Key",
      label: "Please enter your Grok 3 API Key:",
      value: this.data.grok3ApiKey || "",
    });
    if (input) {
      this.data.grok3ApiKey = input;
      Zotero.Prefs.set("extensions.zotero-grok3.apikey", input, true);
    }
  }
}

export default Addon;