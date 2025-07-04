import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits, ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  Colors,
  Message,
  GuildTextBasedChannel, ChannelSelectMenuBuilder,
  ComponentType,
  ChannelSelectMenuInteraction,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { Command } from "../types/command";
import { commandErrorHandler } from "../middleware/errorHandler";

// Helper to validate hex color
function parseColor(input: string | undefined): number | undefined {
  if (!input) return undefined;
  if (/^#?[0-9a-fA-F]{6}$/.test(input)) {
    return parseInt(input.replace(/^#/, ""), 16);
  }
  return undefined;
}

const command: Command = {
  meta: {
    name: "embed",
    description: "Create and send a custom embed message to any channel.",
    category: "Utility",
    permissions: ["Administrator"],
    usage: "/embed",
    examples: ["/embed"],
    cooldown: 5,
    guildOnly: false

  },
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Create and send a custom embed message to any channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  execute: commandErrorHandler(async (interaction: ChatInputCommandInteraction | Message) => {
    // Only allow slash command usage
    if (!(interaction instanceof ChatInputCommandInteraction)) {
      await (interaction as Message).reply("❌ Please use this command as a slash command.");
      return;
    }

    // Step 1: Ask for channel selection
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId("embed_channel_select")
      .setPlaceholder("Select a channel to send the embed")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.reply({
      content: "Select the channel where you want to send the embed:",
      components: [channelRow],
      ephemeral: true,
    });

    // Wait for channel selection
    const channelSelectInteraction = await interaction.channel?.awaitMessageComponent({
      componentType: ComponentType.ChannelSelect,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    }) as ChannelSelectMenuInteraction;

    if (!channelSelectInteraction) {
      await interaction.editReply({ content: "❌ Timed out. Please try again.", components: [] });
      return;
    }

    const selectedChannel = channelSelectInteraction.channels.first() as GuildTextBasedChannel | null;
    if (!selectedChannel || !selectedChannel.isTextBased()) {
      await channelSelectInteraction.reply({ content: "❌ Invalid channel selected.", ephemeral: true });
      return;
    }

    // Step 2: Show modal for embed details
    const modal = new ModalBuilder()
      .setCustomId("embed_modal")
      .setTitle("Customize Embed");

    const titleInput = new TextInputBuilder()
      .setCustomId("embed_title")
      .setLabel("Title")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256)
      .setRequired(false);

    const descInput = new TextInputBuilder()
      .setCustomId("embed_desc")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2048)
      .setRequired(true);

    const colorInput = new TextInputBuilder()
      .setCustomId("embed_color")
      .setLabel("Color (hex, e.g. #5865F2)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const imageInput = new TextInputBuilder()
      .setCustomId("embed_image")
      .setLabel("Image URL (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const thumbInput = new TextInputBuilder()
      .setCustomId("embed_thumb")
      .setLabel("Thumbnail URL (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(thumbInput)
    );

    await channelSelectInteraction.showModal(modal);

    // Wait for modal submit
    const modalSubmit = await channelSelectInteraction.awaitModalSubmit({
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    }).catch(() => null) as ModalSubmitInteraction | null;

    if (!modalSubmit) {
      await channelSelectInteraction.editReply({ content: "❌ Timed out. Please try again.", components: [] });
      return;
    }

    // Step 3: Build the embed
    const embed = new EmbedBuilder();
    const title = modalSubmit.fields.getTextInputValue("embed_title");
    const description = modalSubmit.fields.getTextInputValue("embed_desc");
    const color = modalSubmit.fields.getTextInputValue("embed_color");
    const image = modalSubmit.fields.getTextInputValue("embed_image");
    const thumb = modalSubmit.fields.getTextInputValue("embed_thumb");

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (parseColor(color)) embed.setColor(parseColor(color)!);
    else embed.setColor(Colors.Blurple);
    if (image) embed.setImage(image);
    if (thumb) embed.setThumbnail(thumb);

    // Step 4: Preview and confirm
    const previewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("embed_send")
        .setLabel("Send Embed")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("embed_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    await modalSubmit.reply({
      content: `Preview your embed below. Click "Send Embed" to send it to <#${selectedChannel.id}>.`,
      embeds: [embed],
      components: [previewRow],
      ephemeral: true,
    });

    // Wait for button interaction
    const buttonInteraction = await modalSubmit.channel?.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    }).catch(() => null);

    if (!buttonInteraction) {
      await modalSubmit.editReply({ content: "❌ Timed out. Please try again.", components: [] });
      return;
    }

    if (buttonInteraction.customId === "embed_send") {
      await selectedChannel.send({ embeds: [embed] });
      await buttonInteraction.update({
        content: `✅ Embed sent to <#${selectedChannel.id}>!`,
        embeds: [],
        components: [],
      });
    } else {
      await buttonInteraction.update({
        content: "❌ Embed sending cancelled.",
        embeds: [],
        components: [],
      });
    }
  }, "embed"),
};

export default command;
