require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const wanakana = require('wanakana');
const pinyin = require('pinyin');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Traduz usando DeepL (grátis) com fallback
async function traduzir(texto, para = 'en') {
  const target = para.toUpperCase();
  try {
    const res = await axios.post('https://api-free.deepl.com/v2/translate',
      new URLSearchParams({ text: texto, target_lang: target }),
      { headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_KEY}` } }
    );
    return res.data.translations[0].text;
  } catch (e) {
    console.log('DeepL falhou, usando MyMemory:', e.message);
    const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=auto|${para}`);
    return res.data.responseData.translatedText;
  }
}

function getRomanizado(texto, idioma) {
  try {
    if (idioma === 'ja') return wanakana.toRomaji(texto);
    if (idioma === 'zh') return pinyin(texto, { style: pinyin.STYLE_TONE2 }).flat().join(' ');
  } catch {}
  return null;
}

const langs = [
  { name: 'Inglês', value: 'en' },
  { name: 'Português', value: 'pt' },
  { name: 'Espanhol', value: 'es' },
  { name: 'Japonês + Romaji', value: 'ja' },
  { name: 'Chinês + Pinyin', value: 'zh' },
  { name: 'Coreano', value: 'ko' },
  { name: 'Francês', value: 'fr' },
  { name: 'Alemão', value: 'de' },
  { name: 'Italiano', value: 'it' },
  { name: 'Russo', value: 'ru' },
];

const commands = [
  new SlashCommandBuilder()
   .setName('translate')
   .setDescription('Traduz a última mensagem (só você vê)')
   .addStringOption(o => o.setName('idioma').setDescription('Para qual língua').setRequired(true).addChoices(...langs))
   .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Comando /translate registrado!');
  } catch (err) { console.error(err); }
})();

client.on('ready', () => console.log(`🤖 Logado como ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName!== 'translate') return;

  await interaction.deferReply({ ephemeral: true });

  const idioma = interaction.options.getString('idioma');
  let texto = null;

  try {
    const fetched = await interaction.channel.messages.fetch({ limit: 20 });
    const msgs = [...fetched.values()].filter(m =>!m.author.bot && m.content && m.id!== interaction.id);
    if (msgs.length > 0) texto = msgs[0].content;
  } catch {}

  if (!texto) return interaction.editReply('❌ Não achei mensagem pra traduzir. Envie uma mensagem antes e use `/translate` respondendo ela.');

  try {
    const traduzido = await traduzir(texto, idioma);
    let resposta = `**Original:** ${texto.slice(0, 500)}\n**${idioma.toUpperCase()}:** ${traduzido}`;

    if (['ja', 'zh'].includes(idioma)) {
      const roma = getRomanizado(traduzido, idioma);
      if (roma) resposta += `\n**Romanizado:** ${roma.slice(0, 500)}`;
    }

    return interaction.editReply(resposta);
  } catch (e) {
    console.error(e);
    return interaction.editReply('❌ Erro ao traduzir. Verifica a DEEPL_KEY no.env');
  }
});

client.login(process.env.DISCORD_TOKEN);