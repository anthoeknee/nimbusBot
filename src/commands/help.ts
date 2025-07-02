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
  MessageFlags
} from "discord.js";
import { Command } from "../types/command";
import { client } from "../index"; // Adjust path to your main client file

const command: Command = {
  meta: {
    name: "help",
    description: "Get help with bot commands",
    category: "Utility"
  },
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with bot commands")
    .addStringOption(option =>
      option
        .setName("command")
        .setDescription("Get detailed help for a specific command")
        .setRequired(false)
    ) as SlashCommandBuilder,
  
  execute: async (interactionOrMessage: ChatInputCommandInteraction | Message, context?: { args?: string[] }) => {
    // If called as a slash command
    if ("options" in interactionOrMessage) {
      const specificCommand = interactionOrMessage.options.getString("command");
      if (specificCommand) {
        await sendSpecificCommandHelp(interactionOrMessage, specificCommand);
      } else {
        await sendGeneralHelp(interactionOrMessage);
      }
      return;
    }

    // If called as a prefix (message) command
    const args = context?.args || [];
    const specificCommand = args[0];
    if (specificCommand) {
      await sendSpecificCommandHelp(interactionOrMessage, specificCommand);
    } else {
      await sendGeneralHelp(interactionOrMessage);
    }
  }
};

// Get commands organized by category
function getCommandsByCategory() {
  const categories: { [key: string]: Command[] } = {};

  // Get all commands from the client's commands Map
  (client as any).commands?.forEach((cmd: Command) => {
    const category = cmd.meta?.category || "General";
    if (!categories[category]) categories[category] = [];
    categories[category].push(cmd);
  });

  return categories;
}

// Send general help (all commands organized by category)
async function sendGeneralHelp(target: ChatInputCommandInteraction | Message) {
  const categories = getCommandsByCategory();
  const categoryNames = Object.keys(categories);

  if (categoryNames.length === 0) {
    if ("reply" in target && typeof target.reply === "function") {
      await target.reply({
        content: "❌ No commands found!",
        ephemeral: true
      });
    }
    return;
  }

  // Create main embed
  const mainEmbed = new EmbedBuilder()
    .setTitle("🤖 Bot Help")
    .setDescription("Select a category below to view commands, or use `/help <command>` for detailed help.")
    .setColor(0x5865F2)
    .addFields(
      categoryNames.map(category => ({
        name: `${getCategoryEmoji(category)} ${category}`,
        value: `${categories[category].length} command${categories[category].length !== 1 ? 's' : ''}`,
        inline: true
      }))
    )
    .setFooter({ 
      text: `Total: ${(client as any).commands?.size || 0} commands` 
    })
    .setTimestamp();
  if (categoryNames.length <= 5) {
    // Show all commands in a simple format
    const allCommandsEmbed = new EmbedBuilder()
      .setTitle("🤖 All Bot Commands")
      .setDescription("Here are all available commands organized by category:")
      .setColor(0x5865F2)
      .setFooter({ 
        text: `Use /help <command> for detailed information about a specific command` 
      })
      .setTimestamp();

    categoryNames.forEach(category => {
      const commands = categories[category];
      const commandList = commands.map(cmd => 
        `\`/${cmd.meta.name}\` - ${cmd.meta.description || 'No description'}`
      ).join('\n');
      
      allCommandsEmbed.addFields({
        name: `${getCategoryEmoji(category)} ${category}`,
        value: commandList || "No commands",
        inline: false
      });
    });

    if ("reply" in target && typeof target.reply === "function") {
      await target.reply({
        embeds: [allCommandsEmbed],
        ephemeral: true
      });
    }
    return;
  }

  // Create category select menu for many categories
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder("Choose a category to view commands")
    .addOptions(
      categoryNames.slice(0, 25).map(category => ({ // Discord limit of 25 options
        label: category,
        value: category,
        description: `View ${categories[category].length} command${categories[category].length !== 1 ? 's' : ''} in ${category}`,
        emoji: getCategoryEmoji(category)
      }))
    );

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  const response = await target.reply({
    embeds: [mainEmbed],
    components: [selectRow],
    ephemeral: true
  });

  // Handle category selection
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (selectInteraction) => {
    // Fix: Check if target is a ChatInputCommandInteraction (has .user), otherwise fallback to .author (for Message)
    const targetUserId = 'user' in target ? target.user.id : ('author' in target ? target.author.id : null);
    if (selectInteraction.user.id !== targetUserId) {
      await selectInteraction.reply({
        content: "❌ This help menu is not for you!",
        ephemeral: true
      });
      return;
    }

    const selectedCategory = selectInteraction.values[0];
    const categoryCommands = categories[selectedCategory];

    const categoryEmbed = new EmbedBuilder()
      .setTitle(`${getCategoryEmoji(selectedCategory)} ${selectedCategory} Commands`)
      .setDescription(`Here are all the commands in the **${selectedCategory}** category:`)
      .setColor(0x5865F2)
      .addFields(
        categoryCommands.map(cmd => ({
          name: `/${cmd.meta.name}`,
          value: `${cmd.meta.description || 'No description provided'}\n\`Usage: /${cmd.meta.name}\``,
          inline: false
        }))
      )
      .setFooter({ 
        text: `${categoryCommands.length} command${categoryCommands.length !== 1 ? 's' : ''} | Use /help <command> for detailed help` 
      })
      .setTimestamp();

    // Back button
    const backButton = new ButtonBuilder()
      .setCustomId("help_back")
      .setLabel("← Back to Categories")
      .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(backButton);

    await selectInteraction.update({
      embeds: [categoryEmbed],
      components: [buttonRow]
    });

    // Handle back button
    const buttonCollector = selectInteraction.message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000
    });

    buttonCollector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === 'help_back') {
        await buttonInteraction.update({
          embeds: [mainEmbed],
          components: [selectRow]
        });
      }
    });
  });

  collector.on('end', async () => {
    try {
      await response.edit({
        components: []
      });
    } catch (error) {
      // Message might be deleted
    }
  });
}

// Send help for a specific command
import { APIApplicationCommandOption } from "discord.js";

// Helper to get the commands map from the client, with proper typing
function getCommandsMap(): Map<string, Command> {
  // @ts-ignore
  return (client as any).commands as Map<string, Command>;
}

async function sendSpecificCommandHelp(target: ChatInputCommandInteraction | Message, commandName: string) {
  const commandsMap = getCommandsMap();
  const command = commandsMap?.get(commandName);

  if (!command) {
    // Try to find command with similar name
    const similarCommands = Array.from(commandsMap?.values() || [])
      .filter((cmd: Command) =>
        cmd.meta.name.toLowerCase().includes(commandName.toLowerCase()) ||
        commandName.toLowerCase().includes(cmd.meta.name.toLowerCase())
      )
      .slice(0, 5);

    if (similarCommands.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Command Not Found")
        .setDescription(`Command \`${commandName}\` not found. Did you mean one of these?`)
        .setColor(0xFF0000)
        .addFields({
          name: "Similar Commands",
          value: similarCommands
            .map((cmd: Command) => `\`/${cmd.meta.name}\` - ${cmd.meta.description}`)
            .join('\n'),
          inline: false
        })
        .setTimestamp();

      if ("reply" in target && typeof target.reply === "function") {
        await target.reply({
          embeds: [embed],
          ephemeral: true
        });
      }
      return;
    }

    if ("reply" in target && typeof target.reply === "function") {
      await target.reply({
        content: `❌ Command \`${commandName}\` not found! Use \`/help\` to see all available commands.`,
        ephemeral: true
      });
    }
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📖 Command: /${command.meta.name}`)
    .setColor(0x5865F2)
    .addFields(
      {
        name: "Description",
        value: command.meta.description || "No description provided",
        inline: false
      },
      {
        name: "Category",
        value: command.meta.category || "General",
        inline: true
      },
      {
        name: "Usage",
        value: `\`/${command.meta.name}\``,
        inline: true
      }
    )
    .setTimestamp();

  // Add slash command options if they exist
  // The .options property is not public API, so we use type assertion and fallback
  // to [] if not present
  const options: APIApplicationCommandOption[] =
    // @ts-ignore
    (command.data.options as APIApplicationCommandOption[]) || [];

  if (options.length > 0) {
    const optionsText = options.map((option) => {
      const required = option.required ? '(Required)' : '(Optional)';
      return `\`${option.name}\` - ${option.description ?? "No description"} ${required}`;
    }).join('\n');

    embed.addFields({
      name: "Options",
      value: optionsText,
      inline: false
    });
  }

  // Add additional info if available
  if (command.meta.examples) {
    embed.addFields({
      name: "Examples",
      value: Array.isArray(command.meta.examples)
        ? (command.meta.examples as string[]).map((ex: string) => `\`${ex}\``).join('\n')
        : `\`${command.meta.examples}\``,
      inline: false
    });
  }

  if (command.meta.permissions) {
    embed.addFields({
      name: "Required Permissions",
      value: Array.isArray(command.meta.permissions)
        ? (command.meta.permissions as string[]).join(', ')
        : (command.meta.permissions as string),
      inline: false
    });
  }

  if ("reply" in target && typeof target.reply === "function") {
    await target.reply({
      embeds: [embed],
      ephemeral: "ephemeral" in target ? true : false
    });
  }
}

// Helper function for category emojis
function getCategoryEmoji(category: string): string {
  const emojiMap: { [key: string]: string } = {
    'General': '🔧',
    'Utility': '⚙️',
    'Moderation': '🛡️',
    'Fun': '🎉',
    'Music': '🎵',
    'Economy': '💰',
    'Admin': '👑',
    'Gaming': '🎮',
    'Information': 'ℹ️',
    'Social': '👥'
  };

  return emojiMap[category] || '📁';
}

export default command;