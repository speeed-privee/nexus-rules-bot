const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Events
} = require('discord.js');

require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`Rules Bot Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  let embed;

  if (interaction.values[0] === "general") {
    embed = new EmbedBuilder()
      .setTitle("📜 القوانين العامة")
      .setDescription(`
1. احترام جميع الأعضاء واجب
2. يمنع السب، الشتم أو العنصرية
3. يمنع نشر محتوى غير لائق
4. يمنع السبام أو الإزعاج
5. يمنع انتحال شخصية أي عضو أو إداري
6. يمنع نشر روابط بدون إذن
7. الالتزام بتعليمات الإدارة
8. يمنع إثارة المشاكل أو الفتن
9. يمنع طلب الرتب أو الإزعاج عليها
10. احترام جميع القوانين بدون استثناء
      `)
      .setColor("#2b2d31");
  }

  if (interaction.values[0] === "discord") {
    embed = new EmbedBuilder()
      .setTitle("💬 قوانين الديسكورد")
      .setDescription(`
1. استعمل كل روم في المكان المخصص له
2. يمنع منشن @everyone بدون سبب
3. يمنع نشر الإعلانات بدون إذن
4. يمنع إرسال رسائل مزعجة في الخاص
5. يمنع نشر معلومات شخصية
6. يمنع التخريب داخل السيرفر
7. يمنع استخدام أسماء أو صور غير لائقة
8. الالتزام بنظام السيرفر
      `)
      .setColor("#5865F2");
  }

  if (interaction.values[0] === "crime") {
    embed = new EmbedBuilder()
      .setTitle("🚔 قوانين الإجرام (RP)")
      .setDescription(`
1. يمنع RDM (قتل بدون سبب RP)
2. يمنع VDM (دهس بدون سبب)
3. احترام جميع سيناريوهات RP
4. يمنع PowerGaming
5. يمنع MetaGaming
6. يجب إعطاء فرصة قبل القتل
7. يمنع استغلال الثغرات
8. السرقة تكون بسيناريو واضح
9. يمنع الهروب الغير منطقي
10. احترام الواقعية في اللعب
      `)
      .setColor("Red");
  }

  if (interaction.values[0] === "police") {
    embed = new EmbedBuilder()
      .setTitle("🏛️ قوانين الشرطة")
      .setDescription(`
1. احترام المواطنين
2. عدم استعمال القوة بدون سبب
3. اتباع أوامر القائد
4. عدم الفساد أو استغلال السلطة
5. الالتزام بالزي الرسمي
6. التدخل فقط عند الحاجة
7. احترام قوانين RP
      `)
      .setColor("Blue");
  }

  if (interaction.values[0] === "punishment") {
    embed = new EmbedBuilder()
      .setTitle("⚖️ العقوبات")
      .setDescription(`
1. مخالفة بسيطة = تحذير
2. تكرار المخالفة = ميوت / كيك
3. مخالفة متوسطة = بان مؤقت
4. مخالفة كبيرة = بان دائم
5. استغلال الثغرات = بان مباشر
6. الإهانة = ميوت أو بان
      `)
      .setColor("Orange");
  }

  if (embed) {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.on(Events.ClientReady, async () => {
  const channelId = process.env.CHANNEL_ID;
  const channel = await client.channels.fetch(channelId);

  const embed = new EmbedBuilder()
    .setTitle("📜 قوانين السيرفر")
    .setDescription(`
اختر القسم الذي تريد الاطلاع على قوانينه من القائمة أدناه

🔹 جميع الردود ستكون مخفية لك فقط
🔹 اقرأ القوانين بعناية
🔹 في حالة وجود استفسار تواصل مع الإدارة
    `)
    .setImage(process.env.IMAGE_URL || "")
    .setColor("#2b2d31");

  const menu = new StringSelectMenuBuilder()
    .setCustomId("rules_menu")
    .setPlaceholder("اختر قسم القوانين...")
    .addOptions([
      { label: "القوانين العامة", value: "general", emoji: { id: '1452693592731816077' } },
      { label: "قوانين الديسكورد", value: "discord", emoji: { id: '1452693592731816077' } },
      { label: "قوانين الإجرام", value: "crime", emoji: { id: '1452693592731816077' } },
      { label: "قوانين الشرطة", value: "police", emoji: { id: '1452693592731816077' } },
      { label: "العقوبات", value: "punishment", emoji: { id: '1452693592731816077' } }
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  channel.send({ embeds: [embed], components: [row] });
});

client.login(process.env.TOKEN);
