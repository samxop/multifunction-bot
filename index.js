require("dotenv").config();
const express = require("express");

const {
Client,
GatewayIntentBits,
PermissionsBitField,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
SlashCommandBuilder,
REST,
Routes
} = require("discord.js");

/* ================================
EXPRESS SERVER (Render)
================================ */

const app = express();
app.get("/", (req,res)=>res.send("Bot running"));

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log(`Express server running on ${PORT}`);
});

/* ================================
DISCORD CLIENT
================================ */

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildVoiceStates
]
});

/* ================================
STORAGE
================================ */

const guildLogs = new Map();
const guildWelcome = new Map();

/* ================================
EMBED HELPER
================================ */

function embed(title,description,color="Blue"){

return new EmbedBuilder()
.setTitle(title)
.setDescription(description)
.setColor(color)
.setTimestamp();

}

/* ================================
LOG FUNCTION
================================ */

function sendLog(guild,embedMsg){

const channelId = guildLogs.get(guild.id);
if(!channelId) return;

const channel = guild.channels.cache.get(channelId);
if(!channel) return;

channel.send({embeds:[embedMsg]}).catch(()=>{});

}

/* ================================
SLASH COMMANDS
================================ */

const commands=[

new SlashCommandBuilder()
.setName("help")
.setDescription("Show bot commands"),

new SlashCommandBuilder()
.setName("set-logs")
.setDescription("Set logging channel")
.addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),

new SlashCommandBuilder()
.setName("set-welcome")
.setDescription("Set welcome channel")
.addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn user")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o=>o.setName("reason").setDescription("Reason")),

new SlashCommandBuilder()
.setName("mute")
.setDescription("Timeout user")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addIntegerOption(o=>o.setName("duration").setDescription("Minutes").setRequired(true)),

new SlashCommandBuilder()
.setName("unmute")
.setDescription("Remove timeout from user")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("kick")
.setDescription("Kick user")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("ban")
.setDescription("Ban user")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("unban")
.setDescription("Unban user")
.addStringOption(o=>o.setName("userid").setDescription("User ID").setRequired(true)),

new SlashCommandBuilder()
.setName("purge")
.setDescription("Delete messages")
.addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),

new SlashCommandBuilder()
.setName("role-add")
.setDescription("Add role")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),

new SlashCommandBuilder()
.setName("role-remove")
.setDescription("Remove role")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),

new SlashCommandBuilder()
.setName("drag-me")
.setDescription("Request to join someone's VC")
.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(true))

].map(cmd=>cmd.toJSON());

/* ================================
REGISTER COMMANDS
================================ */

const rest = new REST({version:"10"}).setToken(process.env.BOT_TOKEN);

(async()=>{

await rest.put(
Routes.applicationCommands(process.env.CLIENT_ID),
{body:commands}
);

console.log("Commands registered");

})();

/* ================================
INTERACTION HANDLER
================================ */

client.on("interactionCreate",async interaction=>{

if(interaction.isButton()){

const id = interaction.customId;

if(id.startsWith("drag_accept_")){

const requesterId = id.split("_")[2];
const requester = await interaction.guild.members.fetch(requesterId);
const target = interaction.member;

if(!target.voice.channel)
return interaction.reply({embeds:[embed("Error","User not in VC","Red")],ephemeral:true});

await requester.voice.setChannel(target.voice.channel);

interaction.update({
embeds:[embed("Request Accepted",`${requester.user.tag} joined VC`,"Green")],
components:[]
});

}

if(id.startsWith("drag_decline_")){

interaction.update({
embeds:[embed("Request Declined","Voice request declined","Red")],
components:[]
});

}

return;

}

if(!interaction.isChatInputCommand()) return;

const {commandName} = interaction;

// ===============================
// WARN
// ===============================
if(commandName === "warn"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
return interaction.reply({
embeds:[embed("Permission Denied","You need Moderate Members permission.","Red")],
ephemeral:true
});

const user = interaction.options.getUser("user");
const reason = interaction.options.getString("reason") || "No reason provided";

interaction.reply({
embeds:[embed("User Warned",`${user} has been warned.\nReason: ${reason}`,"Orange")]
});

sendLog(interaction.guild,
embed("Warn Log",
`${interaction.user.tag} warned ${user.tag}\nReason: ${reason}`,
"Orange")
);

}

// ===============================
// MUTE
// ===============================
if(commandName === "mute"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
return interaction.reply({
embeds:[embed("Permission Denied","You need Moderate Members permission.","Red")],
ephemeral:true
});

const member = await interaction.guild.members.fetch(
interaction.options.getUser("user").id
);

const duration = interaction.options.getInteger("duration");

if(member.id === interaction.user.id)
return interaction.reply({
embeds:[embed("Error","You cannot mute yourself.","Red")],
ephemeral:true
});

if(member.roles.highest.position >= interaction.member.roles.highest.position)
return interaction.reply({
embeds:[embed("Error","You cannot mute someone with an equal or higher role.","Red")],
ephemeral:true
});

if(duration > 40320)
return interaction.reply({
embeds:[embed("Error","Maximum timeout is 28 days.","Red")],
ephemeral:true
});

await member.timeout(duration * 60000);

interaction.reply({
embeds:[embed("User Muted",
`${member.user.tag} has been muted for **${duration} minutes**.`,
"Yellow")]
});

sendLog(interaction.guild,
embed(
"User Muted",
`${interaction.user.tag} muted ${member.user.tag} for ${duration} minutes`,
"Yellow"
)
);

}

// ===============================
// UNMUTE
// ===============================
if(commandName === "unmute"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
return interaction.reply({
embeds:[embed("Permission Denied","You need Moderate Members permission.","Red")],
ephemeral:true
});

const member = await interaction.guild.members.fetch(
interaction.options.getUser("user").id
);

await member.timeout(null);

interaction.reply({
embeds:[embed("User Unmuted",
`${member.user.tag} has been unmuted.`,
"Green")]
});

sendLog(interaction.guild,
embed(
"User Unmuted",
`${interaction.user.tag} removed timeout from ${member.user.tag}`,
"Green"
)
);

}

// ===============================
// KICK
// ===============================
if(commandName === "kick"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
return interaction.reply({
embeds:[embed("Permission Denied","You need Kick Members permission.","Red")],
ephemeral:true
});

const member = await interaction.guild.members.fetch(
interaction.options.getUser("user").id
);

await member.kick();

interaction.reply({
embeds:[embed("User Kicked",`${member.user.tag} was kicked`,"Red")]
});

sendLog(interaction.guild,
embed("User Kicked",
`${interaction.user.tag} kicked ${member.user.tag}`,
"Red")
);

}

// ===============================
// BAN
// ===============================
if(commandName === "ban"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
return interaction.reply({
embeds:[embed("Permission Denied","You need Ban Members permission.","Red")],
ephemeral:true
});

const user = interaction.options.getUser("user");

await interaction.guild.members.ban(user);

interaction.reply({
embeds:[embed("User Banned",`${user.tag} was banned`,"Red")]
});

sendLog(interaction.guild,
embed("User Banned",
`${interaction.user.tag} banned ${user.tag}`,
"Red")
);

}

// ===============================
// UNBAN
// ===============================
if(commandName === "unban"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
return interaction.reply({
embeds:[embed("Permission Denied","You need Ban Members permission.","Red")],
ephemeral:true
});

const id = interaction.options.getString("userid");

await interaction.guild.members.unban(id);

interaction.reply({
embeds:[embed("User Unbanned",`User ID ${id} has been unbanned`,"Green")]
});

sendLog(interaction.guild,
embed("User Unbanned",
`${interaction.user.tag} unbanned user ID ${id}`,
"Green")
);

}

/* HELP */

if(commandName==="help"){

interaction.reply({
embeds:[embed(
"Bot Commands",
`⚙ Setup
/set-logs
/set-welcome

🛡 Moderation
/warn
/mute
/kick
/ban
/unban
/purge

🎭 Roles
/role-add
/role-remove

🔊 Voice
/drag-me`
)]
});

}

/* SET LOG CHANNEL */

if(commandName==="set-logs"){

const channel = interaction.options.getChannel("channel");

guildLogs.set(interaction.guild.id,channel.id);

interaction.reply({
embeds:[embed("Logs Channel Set",`${channel} will receive logs`,"Green")]
});

}

/* SET WELCOME */

if(commandName==="set-welcome"){

const channel = interaction.options.getChannel("channel");

guildWelcome.set(interaction.guild.id,channel.id);

interaction.reply({
embeds:[embed("Welcome Channel Set",`${channel} will receive welcomes`,"Green")]
});

}

/* PURGE */

/* PURGE */

if(commandName === "purge"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
return interaction.reply({
embeds:[embed("Error","Missing Manage Messages permission.","Red")],
ephemeral:true
});

let amount = interaction.options.getInteger("amount");

if(amount > 300)
return interaction.reply({
embeds:[embed("Error","Maximum purge limit is 300 messages.","Red")],
ephemeral:true
});

await interaction.deferReply({ ephemeral:true });

let deleted = 0;

try{

while(amount > 0){

const batch = amount > 100 ? 100 : amount;

const messages = await interaction.channel.bulkDelete(batch,true);

deleted += messages.size;

if(messages.size === 0) break;

amount -= batch;

}

await interaction.editReply({
embeds:[embed("Messages Deleted",`${deleted} messages removed.`,"Orange")]
});

sendLog(interaction.guild,
embed(
"Messages Purged",
`${interaction.user.tag} deleted ${deleted} messages in ${interaction.channel}`,
"Orange"
)
);

}catch(err){

console.error(err);

await interaction.editReply({
embeds:[embed("Error","Failed to purge messages.","Red")]
});

}

}

/* ROLE ADD */

if(commandName==="role-add"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
return interaction.reply({
embeds:[embed("Permission Denied","You need Manage Roles permission.","Red")],
ephemeral:true
});

const member = await interaction.guild.members.fetch(
interaction.options.getUser("user").id
);

const role = interaction.options.getRole("role");

if(role.position >= interaction.guild.members.me.roles.highest.position)
return interaction.reply({
embeds:[embed("Error","I cannot assign that role due to role hierarchy.","Red")],
ephemeral:true
});

await member.roles.add(role);

interaction.reply({
embeds:[embed("Role Added",`${role} added to ${member.user.tag}`,"Green")]
});

sendLog(interaction.guild,
embed("Role Added",
`${interaction.user.tag} added ${role.name} to ${member.user.tag}`,
"Green")
);

}


/* ROLE REMOVE */

if(commandName==="role-remove"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
return interaction.reply({
embeds:[embed("Permission Denied","You need Manage Roles permission.","Red")],
ephemeral:true
});

const member = await interaction.guild.members.fetch(
interaction.options.getUser("user").id
);

const role = interaction.options.getRole("role");

await member.roles.remove(role);

interaction.reply({
embeds:[embed("Role Removed",`${role} removed from ${member.user.tag}`,"Orange")]
});

sendLog(interaction.guild,
embed("Role Removed",
`${interaction.user.tag} removed ${role.name} from ${member.user.tag}`,
"Orange")
);

}


/* DRAG ME */

if(commandName==="drag-me"){

const requester = interaction.member;
const targetUser = interaction.options.getUser("user");
const target = await interaction.guild.members.fetch(targetUser.id);

if(!requester.voice.channel)
return interaction.reply({
embeds:[embed("Error","You must be in a voice channel first.","Red")],
ephemeral:true
});

const accept = new ButtonBuilder()
.setCustomId(`drag_accept_${requester.id}`)
.setLabel("Accept")
.setStyle(ButtonStyle.Success);

const decline = new ButtonBuilder()
.setCustomId(`drag_decline_${requester.id}`)
.setLabel("Decline")
.setStyle(ButtonStyle.Danger);

const row = new ActionRowBuilder().addComponents(accept,decline);

interaction.reply({
embeds:[embed("Voice Request",`${requester.user.tag} wants to join your VC.`,"Blue")],
components:[row]
});

}

});

/* ================================
MEMBER JOIN
================================ */

client.on("guildMemberAdd",member=>{

const welcomeChannelId = guildWelcome.get(member.guild.id);

if(welcomeChannelId){

const channel = member.guild.channels.cache.get(welcomeChannelId);

channel.send({
embeds:[embed("Welcome",`Welcome ${member} to the server!`,"Green")]
});

}

sendLog(member.guild,
embed("Member Joined",member.user.tag,"Green")
);

});

/* ================================
MEMBER LEAVE
================================ */

client.on("guildMemberRemove",member=>{

sendLog(member.guild,
embed("Member Left",member.user.tag,"Red")
);

});

/* ================================
MESSAGE DELETE
================================ */

client.on("messageDelete",message=>{

if(!message.guild || !message.author || message.author.bot) return;

sendLog(message.guild,
embed("Message Deleted",
`User: ${message.author.tag}
Channel: ${message.channel}

Content:
${message.content || "No content"}`,"Red")
);

});

/* ================================
MESSAGE EDIT
================================ */

client.on("messageUpdate",(oldMsg,newMsg)=>{

if(!oldMsg.guild) return;
if(oldMsg.content === newMsg.content) return;

sendLog(oldMsg.guild,
embed("Message Edited",
`User: ${oldMsg.author.tag}

Old:
${oldMsg.content}

New:
${newMsg.content}`,"Yellow")
);

});

/* ================================
VOICE EVENTS
================================ */

client.on("voiceStateUpdate",(oldState,newState)=>{

const member = newState.member;

if(!oldState.channel && newState.channel){

sendLog(member.guild,
embed("Voice Join",`${member.user.tag} joined ${newState.channel.name}`,"Green")
);

}

if(oldState.channel && !newState.channel){

sendLog(member.guild,
embed("Voice Leave",`${member.user.tag} left ${oldState.channel.name}`,"Red")
);

}

if(oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id){

sendLog(member.guild,
embed("Voice Move",
`${member.user.tag}
${oldState.channel.name} → ${newState.channel.name}`,"Blue")
);

}

});

/* ================================
CHANNEL EVENTS
================================ */

client.on("channelCreate",channel=>{
if(!channel.guild) return;

sendLog(channel.guild,
embed("Channel Created",channel.name)
);
});

client.on("channelDelete",channel=>{
if(!channel.guild) return;

sendLog(channel.guild,
embed("Channel Deleted",channel.name,"Red")
);
});

/* ================================
ROLE EVENTS
================================ */

client.on("roleCreate",role=>{
sendLog(role.guild,
embed("Role Created",role.name,"Purple")
);
});

client.on("roleDelete",role=>{
sendLog(role.guild,
embed("Role Deleted",role.name,"Red")
);
});

/* ================================
LOGIN
================================ */
process.on("unhandledRejection", error => {
console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
console.error("Uncaught exception:", error);
});

client.login(process.env.BOT_TOKEN);