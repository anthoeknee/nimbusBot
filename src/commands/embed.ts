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
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  MessageFlags,
  ButtonInteraction
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

    // --- FIX 1: Defer the initial slash command interaction immediately ---
    // Since the first message to the user is ephemeral, defer ephemerally.
    await interaction.deferReply({ ephemeral: true }); // Discord.js still allows this for deferReply, but will deprecate soon

    // Step 1: Ask for channel selection
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId("embed_channel_select")
      .setPlaceholder("Select a channel to send the embed")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    // --- FIX 2: Use editReply after deferring the initial interaction ---
    await interaction.editReply({
      content: "Select the channel where you want to send the embed:",
      components: [channelRow],
      // flags: MessageFlags.Ephemeral, // No longer needed here, handled by deferReply
    });
    const reply = await interaction.fetchReply();

    // Wait for channel selection using a collector
    const channelCollector = reply.createMessageComponentCollector({
      componentType: ComponentType.ChannelSelect,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    const channelSelectInteraction = await new Promise<ChannelSelectMenuInteraction | null>((resolve) => {
      channelCollector.on('collect', (i) => {
        channelCollector.stop();
        resolve(i as ChannelSelectMenuInteraction);
      });
      channelCollector.on('end', (collected) => {
        if (collected.size === 0) resolve(null);
      });
    });

    if (!channelSelectInteraction) {
      try {
        await interaction.editReply({ content: "❌ Timed out. Please try again.", components: [] });
      } catch (e) {
        // Interaction may have expired, ignore error
      }
      return;
    }

    const selectedChannel = channelSelectInteraction.channels.first() as GuildTextBasedChannel | null;
    if (!selectedChannel || !selectedChannel.isTextBased()) {
      // This is a new interaction (the channel select), so `reply` is correct here.
      await channelSelectInteraction.reply({ content: "❌ Invalid channel selected.", flags: MessageFlags.Ephemeral });
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

    // Show modal directly on the channel select interaction.
    // showModal implicitly handles deferral for the interaction it's called on.
    await channelSelectInteraction.showModal(modal);

    // Wait for modal submit using the interaction client
    // Note: Awaiting modal submit from the *original* interaction object
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id && i.customId === "embed_modal",
    }).catch(() => null) as ModalSubmitInteraction | null;

    if (!modalSubmit) {
      try {
        await interaction.editReply({ content: "❌ Timed out. Please try again.", components: [] });
      } catch (e) {
        // Interaction may have expired, ignore error
      }
      return;
    }

    // --- FIX 3: Defer the modal submit interaction ---
    // Before you `editReply` on `modalSubmit`, you must defer it.
    await modalSubmit.deferUpdate(); // Use deferUpdate as we intend to update the message shown to the user

    // Step 3: Build the embed (initial, without fields)
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

    // Step 4: Field management loop
    let fields: { name: string; value: string; inline: boolean }[] = [];
    let managingFields = true;

    while (managingFields) {
      // Show preview with current fields
      embed.setFields(fields);

      const fieldRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("embed_add_field")
          .setLabel("Add Field")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("embed_remove_field")
          .setLabel("Remove Field")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(fields.length === 0),
        new ButtonBuilder()
          .setCustomId("embed_send")
          .setLabel("Send Embed")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("embed_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      );

      // --- Use modalSubmit.editReply() because modalSubmit was deferred ---
      await modalSubmit.editReply({
        content: `Preview your embed below. Add or remove fields as needed, then send.`,
        embeds: [embed],
        components: [fieldRow],
      });

      // Wait for button interaction using a collector
      const previewMsg = await modalSubmit.fetchReply(); // Fetch the latest message for the collector
      const buttonCollector = previewMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      const fieldButton = await new Promise<ButtonInteraction | null>((resolve) => {
        buttonCollector.on('collect', async (i: ButtonInteraction) => {
          // This deferUpdate is already good and essential for button interactions!
          if (!i.replied && !i.deferred) {
            await i.deferUpdate();
          }
          buttonCollector.stop();
          resolve(i);
        });
        buttonCollector.on('end', (collected: any) => {
          if (collected.size === 0) resolve(null);
        });
      });

      if (!fieldButton) {
        try {
          await modalSubmit.editReply({ content: "❌ Timed out. Please try again.", components: [] });
        } catch (e) {
          // Interaction may have expired, ignore error
        }
        return;
      }

      if (fieldButton.customId === "embed_add_field") {
        // Show modal to add a field
        const addFieldModal = new ModalBuilder()
          .setCustomId("embed_add_field_modal")
          .setTitle("Add Embed Field")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("field_name")
                .setLabel("Field Name")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("field_value")
                .setLabel("Field Value")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("field_inline")
                .setLabel("Inline? (yes/no)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        // showModal implicitly handles deferral for the interaction it's called on.
        await fieldButton.showModal(addFieldModal);

        // awaitModalSubmit on the *original* interaction for the modal after button click
        const addFieldSubmit = await interaction.awaitModalSubmit({
          time: 60_000,
          filter: (i) => i.user.id === interaction.user.id,
        }).catch(() => null);

        if (addFieldSubmit) {
          const name = addFieldSubmit.fields.getTextInputValue("field_name");
          const value = addFieldSubmit.fields.getTextInputValue("field_value");
          const inline = addFieldSubmit.fields.getTextInputValue("field_inline").toLowerCase() === "yes";
          fields.push({ name, value, inline });
          // Defer the addFieldSubmit interaction as well, since you're not replying to it directly.
          await addFieldSubmit.deferUpdate();
        }
      } else if (fieldButton.customId === "embed_remove_field") {
        // Show select menu to remove a field
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("embed_remove_field_select")
          .setPlaceholder("Select field(s) to remove")
          .setMinValues(1)
          .setMaxValues(fields.length)
          .addOptions(fields.map((f, i) => ({
            label: f.name,
            value: i.toString(),
          })));

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        // This `reply` is correct because it's a new reply to the `fieldButton` interaction.
        await fieldButton.reply({
          content: "Select field(s) to remove:",
          components: [selectRow],
          flags: MessageFlags.Ephemeral,
        });

        // Wait for select menu interaction using a collector
        const selectMsg = await fieldButton.fetchReply();
        const selectCollector = selectMsg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        const selectInteraction = await new Promise<StringSelectMenuInteraction | null>((resolve) => {
          selectCollector.on('collect', (i: StringSelectMenuInteraction) => {
            selectCollector.stop();
            resolve(i);
          });
          selectCollector.on('end', (collected: any) => {
            if (collected.size === 0) resolve(null);
          });
        });

        if (selectInteraction) {
          const toRemove = selectInteraction.values.map(v => parseInt(v, 10)).sort((a, b) => b - a);
          for (const idx of toRemove) fields.splice(idx, 1);
          await selectInteraction.update({ content: "Field(s) removed.", components: [] });
        }
      } else if (fieldButton.customId === "embed_send") {
        await selectedChannel.send({ embeds: [embed] });
        // `fieldButton.update` is correct here as fieldButton was deferred
        await fieldButton.update({
          content: `✅ Embed sent to <#${selectedChannel.id}>!`,
          embeds: [],
          components: [],
        });
        managingFields = false;
      } else if (fieldButton.customId === "embed_cancel") {
        // `fieldButton.update` is correct here as fieldButton was deferred
        await fieldButton.update({
          content: "❌ Embed sending cancelled.",
          embeds: [],
          components: [],
        });
        managingFields = false;
      }
    }
  }, "embed"),
};

export default command;