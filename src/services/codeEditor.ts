import fs from "fs/promises";
import path from "path";

export class CodeEditorService {
  private readonly rootPath: string;

  constructor() {
    this.rootPath = path.join(process.cwd(), "src");
  }

  async getFileTree(targetPath: string) {
    let normalizedPath = targetPath;
    if (normalizedPath.startsWith("src/")) {
      normalizedPath = normalizedPath.substring(4);
    } else if (normalizedPath === "src") {
      normalizedPath = "";
    }
    
    const fullPath = path.join(this.rootPath, normalizedPath);
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      const directories = [];
      const files = [];

      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name);
        
        if (entry.isDirectory()) {
          const dirEntries = await fs.readdir(entryPath);
          directories.push({
            name: entry.name,
            fileCount: dirEntries.length
          });
        } else {
          const stats = await fs.stat(entryPath);
          files.push({
            name: entry.name,
            size: stats.size,
            type: path.extname(entry.name) || "file"
          });
        }
      }

      return { directories, files };
    } catch (error) {
      console.error(`Error reading directory ${fullPath}:`, error);
      return { directories: [], files: [] };
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    let normalizedPath = filePath;
    if (normalizedPath.startsWith("src/")) {
      normalizedPath = normalizedPath.substring(4);
    }
    
    const fullPath = path.join(this.rootPath, normalizedPath);
    
    try {
      return await Bun.file(fullPath).text();
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}. Full path attempted: ${fullPath}`);
      }
      throw error;
    }
  }

  async getFileInfo(filePath: string) {
    let normalizedPath = filePath;
    if (normalizedPath.startsWith("src/")) {
      normalizedPath = normalizedPath.substring(4);
    }
    
    const fullPath = path.join(this.rootPath, normalizedPath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      return {
        size: stats.size,
        type: path.extname(filePath) || "file",
        modified: stats.mtime.toISOString()
      };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}. Full path attempted: ${fullPath}`);
      }
      throw error;
    }
  }

  async saveFile(filePath: string, content: string): Promise<void> {
    let normalizedPath = filePath;
    if (normalizedPath.startsWith("src/")) {
      normalizedPath = normalizedPath.substring(4);
    }
    
    const fullPath = path.join(this.rootPath, normalizedPath);
    await Bun.write(fullPath, content);
  }

  async createFile(filePath: string, content: string = ""): Promise<void> {
    let normalizedPath = filePath;
    if (normalizedPath.startsWith("src/")) {
      normalizedPath = normalizedPath.substring(4);
    }
    
    const fullPath = path.join(this.rootPath, normalizedPath);
    
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(fullPath, content, "utf-8");
  }

  async deleteFile(filePath: string): Promise<void> {
    let normalizedPath = filePath;
    if (normalizedPath.startsWith("src/")) {
      normalizedPath = normalizedPath.substring(4);
    }
    
    const fullPath = path.join(this.rootPath, normalizedPath);
    await fs.unlink(fullPath);
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    let normalizedOldPath = oldPath;
    let normalizedNewPath = newPath;
    
    if (normalizedOldPath.startsWith("src/")) {
      normalizedOldPath = normalizedOldPath.substring(4);
    }
    if (normalizedNewPath.startsWith("src/")) {
      normalizedNewPath = normalizedNewPath.substring(4);
    }
    
    const oldFullPath = path.join(this.rootPath, normalizedOldPath);
    const newFullPath = path.join(this.rootPath, normalizedNewPath);
    
    const newDir = path.dirname(newFullPath);
    await fs.mkdir(newDir, { recursive: true });
    
    await fs.rename(oldFullPath, newFullPath);
  }

  async getTemplate(fileType: string): Promise<string> {
    const templates = {
      command: `import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../types/command";

export const command: Command = {
  meta: {
    name: "newcommand",
    description: "A new command",
    category: "general",
    cooldown: 3
  },
  data: new SlashCommandBuilder()
    .setName("newcommand")
    .setDescription("A new command"),
  
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply("Hello from new command!");
  }
};`,
      event: `import { ClientEvents } from "discord.js";
import { Event } from "../types/event";

export const event: Event<"messageCreate"> = {
  name: "messageCreate",
  once: false,
  execute(message) {
    // Event logic here
  }
};`,
      service: `import { Service } from "../types/service";

export class NewService implements Service {
  name = "NewService";

  async initialize() {
    // Service initialization logic
  }
}`,
      utility: `// Utility functions

export function newUtility() {
  // Utility logic here
}`,
      types: `// Type definitions

export interface NewType {
  // Type definition here
}`
    };

    return templates[fileType as keyof typeof templates] || "";
  }
}

// Modal submit handlers (add to your interaction handler)
export async function handleModalSubmit(interaction: any) {
  if (!interaction.isModalSubmit()) return;
  
  const codeEditor = new CodeEditorService();
  
  try {
    if (interaction.customId.startsWith("save_file_")) {
      const encodedPath = interaction.customId.replace("save_file_", "");
      const filePath = encodedPath.replace(/\|/g, '/'); // Decode path
      const content = interaction.fields.getTextInputValue("content");
      
      await codeEditor.saveFile(filePath, content);
      
      await interaction.reply({
        content: `✅ File \`${filePath}\` has been saved successfully!`,
        ephemeral: true
      });
    } else if (interaction.customId.startsWith("create_file_") || interaction.customId.startsWith("create_new_")) {
      const encodedPathData = interaction.customId.replace("create_file_", "").replace("create_new_", "");
      const pathData = encodedPathData.replace(/\|/g, '/'); // Decode path
      const filename = interaction.fields.getTextInputValue("filename");
      const content = interaction.fields.getTextInputValue("content") || "";
      
      const filePath = path.join(pathData, filename);
      await codeEditor.createFile(filePath, content);
      
      await interaction.reply({
        content: `✅ File \`${filePath}\` has been created successfully!`,
        ephemeral: true
      });
    } else if (interaction.customId.startsWith("rename_file_")) {
      const encodedPath = interaction.customId.replace("rename_file_", "");
      const oldPath = encodedPath.replace(/\|/g, '/'); // Decode path
      const newName = interaction.fields.getTextInputValue("newname");
      const newPath = path.join(path.dirname(oldPath), newName);
      
      await codeEditor.renameFile(oldPath, newPath);
      
      await interaction.reply({
        content: `✅ File has been renamed from \`${oldPath}\` to \`${newPath}\`!`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error("Modal submit error:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing your request.",
      ephemeral: true
    });
  }
}

export default CodeEditorService;