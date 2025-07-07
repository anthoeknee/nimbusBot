// src/commands/codeEditor.ts
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  Message,
  MessageFlags,
} from "discord.js";
import { Command } from "../types/command";
import { CodeEditorService } from "../services/codeEditor";
import { commandErrorHandler } from "../middleware/errorHandler";
import fs from "fs/promises";
import path from "path";

export const codeEditorCommand: Command = {
  meta: {
    name: "code",
    description: "Manage bot codebase through Discord",
    category: "development",
    permissions: ["Administrator"],
    cooldown: 5,
    guildOnly: false,
  },
  data: new SlashCommandBuilder()
    .setName("code")
    .setDescription("Access the bot's code editor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("browse")
        .setDescription("Browse the codebase")
        .addStringOption((option) =>
          option
            .setName("path")
            .setDescription("Directory path to browse")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edit a specific file")
        .addStringOption((option) =>
          option
            .setName("file")
            .setDescription("File path to edit")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new file")
        .addStringOption((option) =>
          option
            .setName("path")
            .setDescription("File path to create")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("File type")
            .setRequired(true)
            .addChoices(
              { name: "Command", value: "command" },
              { name: "Event", value: "event" },
              { name: "Service", value: "service" },
              { name: "Utility", value: "utility" },
              { name: "Type Definition", value: "types" }
            )
        )
    ) as SlashCommandBuilder,

  execute: async (
    interactionOrMessage: ChatInputCommandInteraction | Message,
    context?: { args?: string[] }
  ) => {
    try {
      if ("options" in interactionOrMessage) {
        // Slash command
        const subcommand = interactionOrMessage.options.getSubcommand();
        const codeEditor = new CodeEditorService();

        switch (subcommand) {
          case "browse":
            await handleBrowse(interactionOrMessage, codeEditor);
            break;
          case "edit":
            await handleEdit(interactionOrMessage, codeEditor);
            break;
          case "create":
            await handleCreate(interactionOrMessage, codeEditor);
            break;
          default:
            throw new Error(`Unknown subcommand: ${subcommand}`);
        }
      } else {
        // Prefix command
        const args = context?.args || [];
        const subcommand = args[0];

        if (!subcommand) {
          throw new Error(
            "No subcommand provided. Use: browse, edit, or create"
          );
        }

        const codeEditor = new CodeEditorService();

        switch (subcommand) {
          case "browse":
            await handleBrowsePrefix(interactionOrMessage, codeEditor, args[1]);
            break;
          case "edit":
            if (!args[1])
              throw new Error("File path is required for edit command");
            await handleEditPrefix(interactionOrMessage, codeEditor, args[1]);
            break;
          case "create":
            if (!args[1])
              throw new Error("File path is required for create command");
            if (!args[2])
              throw new Error("File type is required for create command");
            await handleCreatePrefix(
              interactionOrMessage,
              codeEditor,
              args[1],
              args[2]
            );
            break;
          default:
            throw new Error(`Unknown subcommand: ${subcommand}`);
        }
      }
    } catch (error: any) {
      console.error("Command execution error:", error);

      // Ensure we respond to the interaction
      if ("reply" in interactionOrMessage) {
        if (
          "options" in interactionOrMessage &&
          !interactionOrMessage.replied &&
          !interactionOrMessage.deferred
        ) {
          await interactionOrMessage.reply({
            content: `❌ An error occurred: ${error.message}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await (interactionOrMessage as any).reply(
            `❌ An error occurred: ${error.message}`
          );
        }
      }
    }
  },
};

// Slash command handlers
async function handleBrowse(
  interaction: ChatInputCommandInteraction,
  codeEditor: CodeEditorService
) {
  try {
    const targetPath = interaction.options.getString("path") || "src";
    const fileTree = await codeEditor.getFileTree(targetPath);

    const embed = new EmbedBuilder()
      .setTitle("🗂️ Code Browser")
      .setDescription(`**Current Path:** \`${targetPath}\``)
      .setColor(0x00ae86)
      .setTimestamp();

    const components = await createFileTreeComponents(fileTree, targetPath);

    const response = await interaction.reply({
      embeds: [embed],
      components: components,
      flags: MessageFlags.Ephemeral,
    });

    // Set up collector for the response message
    setupComponentCollector(response, codeEditor, targetPath);
  } catch (error: any) {
    console.error("Browse error:", error);
    await interaction.reply({
      content: `❌ Failed to browse directory: ${error.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleEdit(
  interaction: ChatInputCommandInteraction,
  codeEditor: CodeEditorService
) {
  try {
    const filePath = interaction.options.getString("file", true);
    await handleFileEdit(interaction, codeEditor, filePath);
  } catch (error: any) {
    console.error("Edit error:", error);
    await interaction.reply({
      content: `❌ Failed to edit file: ${error.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleCreate(
  interaction: ChatInputCommandInteraction,
  codeEditor: CodeEditorService
) {
  try {
    const filePath = interaction.options.getString("path", true);
    const fileType = interaction.options.getString("type", true);

    const template = await codeEditor.getTemplate(fileType);

    const modal = new ModalBuilder()
      .setCustomId(`create_file_${filePath}_${fileType}`)
      .setTitle("Create New File");

    const nameInput = new TextInputBuilder()
      .setCustomId("filename")
      .setLabel("File Name")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter file name (without extension)")
      .setRequired(true);

    const contentInput = new TextInputBuilder()
      .setCustomId("content")
      .setLabel("File Content")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter file content...")
      .setValue(template)
      .setRequired(false);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      nameInput
    );
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      contentInput
    );

    modal.addComponents(firstRow, secondRow);
    await interaction.showModal(modal);
  } catch (error: any) {
    console.error("Create error:", error);
    await interaction.reply({
      content: `❌ Failed to create file: ${error.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

// Prefix command handlers
async function handleBrowsePrefix(
  message: Message,
  codeEditor: CodeEditorService,
  targetPath?: string
) {
  try {
    const path = targetPath || "src";
    const fileTree = await codeEditor.getFileTree(path);

    const embed = new EmbedBuilder()
      .setTitle("🗂️ Code Browser")
      .setDescription(`**Current Path:** \`${path}\``)
      .setColor(0x00ae86)
      .setTimestamp();

    const components = await createFileTreeComponents(fileTree, path);

    const response = await message.reply({
      embeds: [embed],
      components: components,
    });

    // Set up collector for the response message
    setupComponentCollector(response, codeEditor, path);
  } catch (error: any) {
    console.error("Browse prefix error:", error);
    await message.reply(`❌ Failed to browse directory: ${error.message}`);
  }
}

async function handleEditPrefix(
  message: Message,
  codeEditor: CodeEditorService,
  filePath: string
) {
  try {
    await handleFileEdit(message, codeEditor, filePath);
  } catch (error: any) {
    console.error("Edit prefix error:", error);
    await message.reply(`❌ Failed to edit file: ${error.message}`);
  }
}

async function handleCreatePrefix(
  message: Message,
  codeEditor: CodeEditorService,
  filePath: string,
  fileType: string
) {
  try {
    const template = await codeEditor.getTemplate(fileType);

    const embed = new EmbedBuilder()
      .setTitle("📝 Create File")
      .setDescription(
        `To create a file in \`${filePath}\` with type \`${fileType}\`, please use the slash command:\n\`/code create path:${filePath} type:${fileType}\``
      )
      .addFields({
        name: "Template Preview",
        value: `\`\`\`typescript\n${template.substring(0, 500)}${
          template.length > 500 ? "..." : ""
        }\`\`\``,
      })
      .setColor(0x00ae86)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (error: any) {
    console.error("Create prefix error:", error);
    await message.reply(`❌ Failed to create file: ${error.message}`);
  }
}

function setupComponentCollector(
  message: any,
  codeEditor: CodeEditorService,
  currentPath: string
) {
  const collector = message.createMessageComponentCollector({
    filter: (i: any) =>
      i.user.id === message.interaction?.user.id ||
      i.user.id === message.author?.id,
    time: 300000, // 5 minutes
  });

  collector.on("collect", async (componentInteraction: any) => {
    try {
      console.log(
        "Component interaction received:",
        componentInteraction.customId
      );

      // Check for modal interactions first - these must be handled before deferring
      if (componentInteraction.customId.startsWith("edit_modal_")) {
        const filePath = decodePathFromCustomId(
          componentInteraction.customId.replace("edit_modal_", "")
        );
        const fileContent = await codeEditor.getFileContent(filePath);
        const modal = createEditModal(filePath, fileContent);
        await componentInteraction.showModal(modal);
        return; // Exit early since we've handled the modal
      } else if (componentInteraction.customId.startsWith("rename_")) {
        const filePath = decodePathFromCustomId(
          componentInteraction.customId.replace("rename_", "")
        );
        const modal = createRenameModal(filePath);
        await componentInteraction.showModal(modal);
        return; // Exit early since we've handled the modal
      }

      // Always defer the interaction first to prevent timeout (for non-modal interactions)
      if (!componentInteraction.deferred && !componentInteraction.replied) {
        await componentInteraction.deferUpdate();
      }

      if (componentInteraction.customId === "navigate_directory") {
        const selectedValue = componentInteraction.values[0];
        const newPath = decodePathFromCustomId(
          selectedValue.replace("navigate_", "")
        );
        await handleNavigation(componentInteraction, codeEditor, newPath);
      } else if (componentInteraction.customId === "select_file") {
        const selectedValue = componentInteraction.values[0];
        console.log("Selected value from dropdown:", selectedValue);
        const filePath = decodePathFromCustomId(
          selectedValue.replace("edit_", "")
        );
        console.log("Decoded file path:", filePath);
        await handleFileEdit(componentInteraction, codeEditor, filePath);
      } else if (componentInteraction.customId.startsWith("navigate_")) {
        const newPath = decodePathFromCustomId(
          componentInteraction.customId.replace("navigate_", "")
        );
        await handleNavigation(componentInteraction, codeEditor, newPath);
      } else if (componentInteraction.customId.startsWith("edit_")) {
        const filePath = decodePathFromCustomId(
          componentInteraction.customId.replace("edit_", "")
        );
        await handleFileEdit(componentInteraction, codeEditor, filePath);
      } else if (componentInteraction.customId.startsWith("action_")) {
        await handleFileAction(componentInteraction, codeEditor);
      } else if (componentInteraction.customId.startsWith("delete_")) {
        const filePath = decodePathFromCustomId(
          componentInteraction.customId.replace("delete_", "")
        );
        await handleFileDelete(componentInteraction, codeEditor, filePath);
      } else if (componentInteraction.customId === "back_browser") {
        await handleBrowse(componentInteraction, codeEditor);
      } else if (componentInteraction.customId === "cancel_delete") {
        await handleNavigation(componentInteraction, codeEditor, currentPath);
      } else if (componentInteraction.customId.startsWith("confirm_delete_")) {
        const filePath = decodePathFromCustomId(
          componentInteraction.customId.replace("confirm_delete_", "")
        );
        await codeEditor.deleteFile(filePath);
        await componentInteraction.editReply({
          content: `✅ File \`${filePath}\` has been deleted.`,
          embeds: [],
          components: [],
        });
      }
    } catch (error: any) {
      console.error("Component interaction error:", error);
      try {
        if (!componentInteraction.replied && !componentInteraction.deferred) {
          await componentInteraction.reply({
            content: `❌ An error occurred: ${error.message}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await componentInteraction.followUp({
            content: `❌ An error occurred: ${error.message}`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError: any) {
        console.error("Failed to send error reply:", replyError);
      }
    }
  });

  collector.on("end", () => {
    console.log("Component collector ended");
  });
}

async function handleNavigation(
  interaction: any,
  codeEditor: CodeEditorService,
  newPath: string
) {
  try {
    const fileTree = await codeEditor.getFileTree(newPath);

    const embed = new EmbedBuilder()
      .setTitle("🗂️ Code Browser")
      .setDescription(`**Current Path:** \`${newPath}\``)
      .setColor(0x00ae86)
      .setTimestamp();

    const components = await createFileTreeComponents(fileTree, newPath);

    const response = await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    // Set up new collector for the updated message
    setupComponentCollector(response, codeEditor, newPath);
  } catch (error: any) {
    console.error("Navigation error:", error);
    await interaction.editReply({
      content: `❌ Failed to navigate: ${error.message}`,
      embeds: [],
      components: [],
    });
  }
}

async function handleFileEdit(
  interaction: any,
  codeEditor: CodeEditorService,
  filePath: string
) {
  try {
    const fileContent = await codeEditor.getFileContent(filePath);
    const fileInfo = await codeEditor.getFileInfo(filePath);

    const embed = new EmbedBuilder()
      .setTitle("📝 File Editor")
      .setDescription(`**File:** \`${filePath}\``)
      .addFields(
        { name: "Size", value: `${fileInfo.size} bytes`, inline: true },
        { name: "Type", value: fileInfo.type, inline: true },
        { name: "Modified", value: fileInfo.modified, inline: true }
      )
      .setColor(0x5865f2)
      .setTimestamp();

    // Detect file extension for syntax highlighting
    const fileExtension = path.extname(filePath).substring(1);
    const languageMap: { [key: string]: string } = {
      ts: "typescript",
      js: "javascript",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
      txt: "text",
    };
    const language = languageMap[fileExtension] || "text";

    // Calculate available space for content (accounting for markdown formatting)
    const markdownOverhead = `\`\`\`${language}\n\n\`\`\``.length; // Account for code block formatting
    const maxContentLength = 1024 - markdownOverhead - 50; // Leave some buffer

    // Show file content in code block (truncated if too long)
    let contentPreview = fileContent;
    let isTruncated = false;

    if (fileContent.length > maxContentLength) {
      contentPreview = fileContent.substring(0, maxContentLength);
      isTruncated = true;
    }

    // Add truncation indicator if needed
    if (isTruncated) {
      contentPreview += "\n... (truncated - file too long for preview)";
    }

    embed.addFields({
      name: "Content Preview",
      value: `\`\`\`${language}\n${contentPreview}\n\`\`\``,
    });

    const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_modal_${encodePathForCustomId(filePath)}`)
        .setLabel("Edit File")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("✏️"),
      new ButtonBuilder()
        .setCustomId(`rename_${encodePathForCustomId(filePath)}`)
        .setLabel("Rename")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📝"),
      new ButtonBuilder()
        .setCustomId(`delete_${encodePathForCustomId(filePath)}`)
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🗑️"),
      new ButtonBuilder()
        .setCustomId(`back_browser`)
        .setLabel("Back to Browser")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⬅️")
    );

    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [embed],
        components: [actionButtons],
      });
    } else if (interaction.replied) {
      await interaction.followUp({
        embeds: [embed],
        components: [actionButtons],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components: [actionButtons],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error: any) {
    console.error("File edit error:", error);

    const errorMessage = `❌ Failed to load file: ${error.message}`;

    if (interaction.deferred) {
      await interaction.editReply({
        content: errorMessage,
        embeds: [],
        components: [],
      });
    } else if (interaction.replied) {
      await interaction.followUp({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

function createEditModal(filePath: string, content: string) {
  const modal = new ModalBuilder()
    .setCustomId(`save_file_${encodePathForCustomId(filePath)}`)
    .setTitle("Edit File");

  // Truncate content if too long for modal
  const truncatedContent =
    content.length > 4000 ? content.substring(0, 4000) : content;

  const contentInput = new TextInputBuilder()
    .setCustomId("content")
    .setLabel("File Content")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(truncatedContent)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
    contentInput
  );
  modal.addComponents(row);

  return modal;
}

function createRenameModal(filePath: string) {
  const modal = new ModalBuilder()
    .setCustomId(`rename_file_${encodePathForCustomId(filePath)}`)
    .setTitle("Rename File");

  const nameInput = new TextInputBuilder()
    .setCustomId("newname")
    .setLabel("New File Name")
    .setStyle(TextInputStyle.Short)
    .setValue(path.basename(filePath))
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
  modal.addComponents(row);

  return modal;
}

async function handleFileAction(
  interaction: any,
  codeEditor: CodeEditorService
) {
  try {
    const customId = interaction.customId.replace("action_", "");
    const underscoreIndex = customId.indexOf("_");

    if (underscoreIndex === -1) {
      throw new Error("Invalid action format");
    }

    const action = customId.substring(0, underscoreIndex);
    const encodedPath = customId.substring(underscoreIndex + 1);
    const targetPath = decodePathFromCustomId(encodedPath);

    switch (action) {
      case "create":
        const createModal = new ModalBuilder()
          .setCustomId(`create_new_${encodePathForCustomId(targetPath)}`)
          .setTitle("Create New File");

        const nameInput = new TextInputBuilder()
          .setCustomId("filename")
          .setLabel("File Name")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("example.ts")
          .setRequired(true);

        const contentInput = new TextInputBuilder()
          .setCustomId("content")
          .setLabel("File Content")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Enter file content...")
          .setRequired(false);

        createModal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput)
        );

        await interaction.showModal(createModal);
        break;

      case "refresh":
        await handleNavigation(interaction, codeEditor, targetPath);
        break;

      case "back":
        await handleNavigation(interaction, codeEditor, targetPath);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error("File action error:", error);
    await interaction.editReply({
      content: `❌ Failed to perform action: ${error.message}`,
      embeds: [],
      components: [],
    });
  }
}

async function handleFileDelete(
  interaction: any,
  codeEditor: CodeEditorService,
  filePath: string
) {
  try {
    const embed = new EmbedBuilder()
      .setTitle("🗑️ Delete File")
      .setDescription(`Are you sure you want to delete \`${filePath}\`?`)
      .setColor(0xff0000);

    const confirmButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_delete_${encodePathForCustomId(filePath)}`)
        .setLabel("Yes, Delete")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_delete")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [confirmButtons],
    });
  } catch (error: any) {
    console.error("Delete handler error:", error);
    await interaction.editReply({
      content: `❌ Failed to prepare delete: ${error.message}`,
      embeds: [],
      components: [],
    });
  }
}

async function createFileTreeComponents(fileTree: any, currentPath: string) {
  const components = [];

  try {
    // Navigation dropdown
    if (fileTree.directories && fileTree.directories.length > 0) {
      const directoryOptions = fileTree.directories
        .slice(0, 25)
        .map((dir: any) => ({
          label: `📁 ${dir.name}`,
          value: `navigate_${encodePathForCustomId(
            path.join(currentPath, dir.name)
          )}`,
          description: `${dir.fileCount || 0} files`,
        }));

      const directorySelect = new StringSelectMenuBuilder()
        .setCustomId("navigate_directory")
        .setPlaceholder("Navigate to directory...")
        .addOptions(directoryOptions);

      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          directorySelect
        )
      );
    }

    // File selection dropdown
    if (fileTree.files && fileTree.files.length > 0) {
      const fileOptions = fileTree.files.slice(0, 25).map((file: any) => ({
        label: `📄 ${file.name}`,
        value: `edit_${encodePathForCustomId(
          path.join(currentPath, file.name)
        )}`,
        description: `${file.size || 0} bytes • ${file.type || "unknown"}`,
      }));

      const fileSelect = new StringSelectMenuBuilder()
        .setCustomId("select_file")
        .setPlaceholder("Select file to edit...")
        .addOptions(fileOptions);

      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          fileSelect
        )
      );
    }

    // Action buttons
    const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`action_create_${encodePathForCustomId(currentPath)}`)
        .setLabel("Create File")
        .setStyle(ButtonStyle.Success)
        .setEmoji("➕"),
      new ButtonBuilder()
        .setCustomId(`action_refresh_${encodePathForCustomId(currentPath)}`)
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔄"),
      new ButtonBuilder()
        .setCustomId(
          `action_back_${encodePathForCustomId(path.dirname(currentPath))}`
        )
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⬅️")
        .setDisabled(currentPath === "src" || currentPath === ".")
    );

    components.push(actionButtons);
  } catch (error: any) {
    console.error("Error creating file tree components:", error);
    // Return basic error component
    const errorButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`action_refresh_${encodePathForCustomId(currentPath)}`)
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔄")
    );
    components.push(errorButton);
  }

  return components;
}

function encodePathForCustomId(filePath: string): string {
  // Replace path separators with a safe character that won't conflict with custom ID parsing
  return filePath.replace(/[\/\\]/g, "|");
}

function decodePathFromCustomId(encodedPath: string): string {
  // Restore path separators
  return encodedPath.replace(/\|/g, "/");
}

export default codeEditorCommand;
