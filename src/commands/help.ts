// src/commands/utility/help.ts
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Message,
  ComponentType,
  SlashCommandBuilder,
  MessageFlags,
  StringSelectMenuInteraction,
  ButtonInteraction,
  InteractionResponse,
  APIApplicationCommandOption,
  Collection,
  Client,
  GatewayIntentBits,
} from "discord.js";
import { Command } from "../types/command";
import { commandErrorHandler } from "../middleware/errorHandler";

const COMMANDS_PER_PAGE = 5;

// Define ExtendedClient interface
interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
}

const command: Command = {
  meta: {
    name: "help",
    description: "Get help with bot commands",
    category: "Utility",
    guildOnly: false,
  },
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with bot commands")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Get detailed help for a specific command")
        .setRequired(false),
    ) as SlashCommandBuilder,

  execute: commandErrorHandler(
    async (
      interaction: ChatInputCommandInteraction | Message,
      context?: { args?: string[] },
    ) => {
      // Handle specific command help if requested
      if (interaction instanceof ChatInputCommandInteraction) {
        const commandName = interaction.options.getString("command");
        if (commandName) {
          await sendSpecificCommandHelp(interaction, commandName);
          return;
        }
      } else if (context?.args && context.args.length > 0) {
        await sendSpecificCommandHelp(interaction, context.args[0]);
        return;
      }

      // Show general help
      await sendGeneralHelp(interaction);
    },
    "help",
  ),
};

async function showCategoryPage(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  commands: Command[],
  category: string,
  page: number,
) {
  const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
  const start = page * COMMANDS_PER_PAGE;
  const end = start + COMMANDS_PER_PAGE;
  const pageCommands = commands.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle(`${getCategoryEmoji(category)} ${category} Commands`)
    .setDescription(
      pageCommands
        .map(
          (cmd, i) =>
            `**${start + i + 1}.** \`/${cmd.meta.name}\` - ${cmd.meta.description}`,
        )
        .join("\n") || "No commands in this category.",
    )
    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
    .setColor(0x5865f2);

  // Create navigation buttons - limit to 5 components per row
  const navButtons = [
    new ButtonBuilder()
      .setCustomId("prev_page")
      .setLabel("⬅️ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("next_page")
      .setLabel("Next ➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages - 1),
  ];

  // Add detail buttons for each command (max 3 to stay within component limit)
  const detailButtons = pageCommands.slice(0, 3).map((cmd, i) =>
    new ButtonBuilder()
      .setCustomId(`details_${start + i}`)
      .setLabel(`${cmd.meta.name}`)
      .setStyle(ButtonStyle.Primary),
  );

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...navButtons,
    ...detailButtons,
  );

  await interaction.update({
    embeds: [embed],
    components: [navRow],
  });

  // Button collector for navigation/details
  const buttonCollector = interaction.message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300_000,
  });

  buttonCollector.on("collect", async (btnInteraction: ButtonInteraction) => {
    if (btnInteraction.customId === "prev_page") {
      await showCategoryPage(btnInteraction, commands, category, page - 1);
    } else if (btnInteraction.customId === "next_page") {
      await showCategoryPage(btnInteraction, commands, category, page + 1);
    } else if (btnInteraction.customId.startsWith("details_")) {
      const idx = parseInt(btnInteraction.customId.split("_")[1], 10);
      const cmd = pageCommands[idx - start];
      if (cmd) {
        const detailsEmbed = new EmbedBuilder()
          .setTitle(`📖 /${cmd.meta.name}`)
          .setDescription(formatCommandDetails(cmd))
          .setColor(0x5865f2);
        await btnInteraction.update({
          embeds: [detailsEmbed],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId("back_to_list")
                .setLabel("← Back")
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
        });

        // Back button collector
        const backCollector =
          btnInteraction.message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300_000,
          });
        backCollector.on("collect", async (backBtn: ButtonInteraction) => {
          if (backBtn.customId === "back_to_list") {
            await showCategoryPage(backBtn, commands, category, page);
            backCollector.stop();
          }
        });
      }
    }
  });
}

// Get commands organized by category
function getCommandsByCategory(client: ExtendedClient): {
  [key: string]: Command[];
} {
  const categories: { [key: string]: Command[] } = {};
  if (client.commands) {
    client.commands.forEach((cmd: Command) => {
      const category = cmd.meta?.category || "General";
      if (!categories[category]) categories[category] = [];
      categories[category].push(cmd);
    });
  }
  return categories;
}

// Send general help (all commands organized by category)
async function sendGeneralHelp(target: ChatInputCommandInteraction | Message) {
  const client = target.client as ExtendedClient;
  const categories = getCommandsByCategory(client);
  const categoryNames = Object.keys(categories);

  if (categoryNames.length === 0) {
    const errorMessage = "❌ No commands found!";
    if (target instanceof ChatInputCommandInteraction) {
      await target.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await target.reply(errorMessage);
    }
    return;
  }

  // Create main embed
  const mainEmbed = new EmbedBuilder()
    .setTitle("🤖 Bot Help")
    .setDescription(
      "Select a category below to view commands, or use `/help <command>` for detailed help.",
    )
    .setColor(0x5865f2)
    .addFields(
      categoryNames.map((category) => ({
        name: `${getCategoryEmoji(category)} ${category}`,
        value: `${categories[category].length} command${categories[category].length !== 1 ? "s" : ""}`,
        inline: true,
      })),
    )
    .setFooter({
      text: `Total: ${(client as ExtendedClient).commands?.size || 0} commands`,
    })
    .setTimestamp();

  if (categoryNames.length <= 5) {
    // Show all commands in a simple format
    const allCommandsEmbed = new EmbedBuilder()
      .setTitle("🤖 All Bot Commands")
      .setDescription("Here are all available commands organized by category:")
      .setColor(0x5865f2)
      .setFooter({
        text: `Use /help <command> for detailed information about a specific command`,
      })
      .setTimestamp();

    categoryNames.forEach((category) => {
      const commands = categories[category];
      const commandList = commands
        .map(
          (cmd) =>
            `\`/${cmd.meta.name}\` - ${cmd.meta.description || "No description"}`,
        )
        .join("\n");

      allCommandsEmbed.addFields({
        name: `${getCategoryEmoji(category)} ${category}`,
        value: commandList || "No commands",
        inline: false,
      });
    });

    if (target instanceof ChatInputCommandInteraction) {
      await target.reply({
        embeds: [allCommandsEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await target.reply({ embeds: [allCommandsEmbed] });
    }
    return;
  }

  // Create category select menu for many categories
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder("Choose a category to view commands")
    .addOptions(
      categoryNames.slice(0, 25).map((category) => ({
        // Discord limit of 25 options
        label: category,
        value: category,
        description: `View ${categories[category].length} command${categories[category].length !== 1 ? "s" : ""} in ${category}`,
        emoji: getCategoryEmoji(category),
      })),
    );

  const selectRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  let response: Message;
  if (target instanceof ChatInputCommandInteraction) {
    const interactionResponse = await target.reply({
      embeds: [mainEmbed],
      components: [selectRow],
      flags: MessageFlags.Ephemeral,
    });
    response = await interactionResponse.fetch();
  } else {
    response = await target.reply({
      embeds: [mainEmbed],
      components: [selectRow],
    });
  }

  // Handle category selection
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000, // 5 minutes
  });

  collector.on(
    "collect",
    async (selectInteraction: StringSelectMenuInteraction) => {
      // Check if the user who triggered the original interaction is the same
      const originalUserId =
        target instanceof ChatInputCommandInteraction
          ? target.user.id
          : target.author.id;
      if (selectInteraction.user.id !== originalUserId) {
        await selectInteraction.reply({
          content: "❌ This help menu is not for you!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selectedCategory = selectInteraction.values[0];
      const categoryCommands = categories[selectedCategory];

      const categoryEmbed = new EmbedBuilder()
        .setTitle(
          `${getCategoryEmoji(selectedCategory)} ${selectedCategory} Commands`,
        )
        .setDescription(
          `Here are all the commands in the **${selectedCategory}** category:`,
        )
        .setColor(0x5865f2)
        .addFields(
          categoryCommands.map((cmd) => ({
            name: `/${cmd.meta.name}`,
            value: `${cmd.meta.description || "No description provided"}\n\`Usage: /${cmd.meta.name}\``,
            inline: false,
          })),
        )
        .setFooter({
          text: `${categoryCommands.length} command${categoryCommands.length !== 1 ? "s" : ""} | Use /help <command> for detailed help`,
        })
        .setTimestamp();

      // Back button
      const backButton = new ButtonBuilder()
        .setCustomId("help_back")
        .setLabel("← Back to Categories")
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        backButton,
      );

      await selectInteraction.update({
        embeds: [categoryEmbed],
        components: [buttonRow],
      });

      // Handle back button
      const buttonCollector =
        selectInteraction.message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 300000,
        });

      buttonCollector.on(
        "collect",
        async (buttonInteraction: ButtonInteraction) => {
          if (buttonInteraction.customId === "help_back") {
            await buttonInteraction.update({
              embeds: [mainEmbed],
              components: [selectRow],
            });
          }
        },
      );
    },
  );

  collector.on("end", async () => {
    try {
      await response.edit({
        components: [],
      });
    } catch (error) {
      // Message might be deleted
    }
  });
}

// Helper to get the commands map from the client, with proper typing
function getCommandsCollection(client: ExtendedClient) {
  return client.commands;
}

async function sendSpecificCommandHelp(
  target: ChatInputCommandInteraction | Message,
  commandName: string,
) {
  const client = target.client as ExtendedClient;
  const commandsCollection = getCommandsCollection(client);
  const command = commandsCollection?.get(commandName);

  if (!command) {
    // Try to find command with similar name
    const similarCommands = Array.from(commandsCollection?.values() || [])
      .filter(
        (cmd: Command) =>
          cmd.meta.name.toLowerCase().includes(commandName.toLowerCase()) ||
          commandName.toLowerCase().includes(cmd.meta.name.toLowerCase()),
      )
      .slice(0, 5);

    if (similarCommands.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Command Not Found")
        .setDescription(
          `Command \`${commandName}\` not found. Did you mean one of these?`,
        )
        .setColor(0xff0000)
        .addFields({
          name: "Similar Commands",
          value: similarCommands
            .map(
              (cmd: Command) =>
                `\`/${cmd.meta.name}\` - ${cmd.meta.description}`,
            )
            .join("\n"),
          inline: false,
        })
        .setTimestamp();

      if (target instanceof ChatInputCommandInteraction) {
        await target.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await target.reply({ embeds: [embed] });
      }
      return;
    }

    const notFoundMessage = `❌ Command \`${commandName}\` not found! Use \`/help\` to see all available commands.`;
    if (target instanceof ChatInputCommandInteraction) {
      await target.reply({
        content: notFoundMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await target.reply(notFoundMessage);
    }
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📖 Command: /${command.meta.name}`)
    .setColor(0x5865f2)
    .addFields(
      {
        name: "Description",
        value: command.meta.description || "No description provided",
        inline: false,
      },
      {
        name: "Category",
        value: command.meta.category || "General",
        inline: true,
      },
      {
        name: "Usage",
        value: `\`/${command.meta.name}\``,
        inline: true,
      },
    )
    .setTimestamp();

  // Add slash command options if they exist
  const slashCommand = command.data as SlashCommandBuilder;
  if (slashCommand && "options" in slashCommand) {
    const options = (slashCommand as any).options as
      | APIApplicationCommandOption[]
      | undefined;

    if (options && options.length > 0) {
      const optionsText = options
        .map((option) => {
          const required = option.required ? "(Required)" : "(Optional)";
          return `\`${option.name}\` - ${option.description ?? "No description"} ${required}`;
        })
        .join("\n");

      embed.addFields({
        name: "Options",
        value: optionsText,
        inline: false,
      });
    }
  }

  // Add additional info if available
  if (command.meta.examples) {
    embed.addFields({
      name: "Examples",
      value: Array.isArray(command.meta.examples)
        ? (command.meta.examples as string[])
            .map((ex: string) => `\`${ex}\``)
            .join("\n")
        : `\`${command.meta.examples}\``,
      inline: false,
    });
  }

  if (command.meta.permissions) {
    embed.addFields({
      name: "Required Permissions",
      value: Array.isArray(command.meta.permissions)
        ? (command.meta.permissions as string[]).join(", ")
        : (command.meta.permissions as string),
      inline: false,
    });
  }

  if (target instanceof ChatInputCommandInteraction) {
    await target.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await target.reply({ embeds: [embed] });
  }
}

// Helper function for category emojis
function getCategoryEmoji(category: string): string {
  const emojiMap: { [key: string]: string } = {
    General: "🔧",
    Utility: "⚙️",
    Moderation: "🛡️",
    Fun: "🎉",
    Music: "🎵",
    Economy: "💰",
    Admin: "👑",
    Gaming: "🎮",
    Information: "ℹ️",
    Social: "👥",
  };

  return emojiMap[category] || "📁";
}

function formatCommandDetails(cmd: Command): string {
  let details = `**Description:** ${cmd.meta.description}\n`;
  if (cmd.meta.usage) details += `**Usage:** \`${cmd.meta.usage}\`\n`;
  if (cmd.meta.aliases)
    details += `**Aliases:** ${cmd.meta.aliases.map((a) => `\`${a}\``).join(", ")}\n`;
  if (cmd.meta.examples) {
    const ex = Array.isArray(cmd.meta.examples)
      ? cmd.meta.examples
      : [cmd.meta.examples];
    details += `**Examples:**\n${ex.map((e) => `\`${e}\``).join("\n")}\n`;
  }
  if (cmd.meta.permissions)
    details += `**Permissions:** ${Array.isArray(cmd.meta.permissions) ? cmd.meta.permissions.join(", ") : cmd.meta.permissions}\n`;
  if (cmd.meta.cooldown) details += `**Cooldown:** ${cmd.meta.cooldown}s\n`;
  return details;
}

export default command;
