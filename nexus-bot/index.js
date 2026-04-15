const {
    Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType,
    EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType
} = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const fs = require('fs');
require('dotenv').config();

// ==================== البوت ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ==================== الإعدادات ====================
const CONFIG = {
    TOKEN:                process.env.TOKEN,
    GUILD_ID:             process.env.GUILD_ID,
    TICKET_ADMIN_ROLE_ID: '1483512543606739074',
    BLACKLIST_LOG_CHANNEL_ID: '1483513951386865704',
    LOGS_CHANNEL_ID:      process.env.LOGS_CHANNEL_ID      || null,
    TRANSCRIPT_CHANNEL_ID: process.env.TRANSCRIPT_CHANNEL_ID || null,
    RATINGS_CHANNEL_ID:   process.env.RATINGS_CHANNEL_ID   || null,
    VOICE_CHANNEL_ID:     process.env.VOICE_CHANNEL_ID     || null,
    CATEGORY_IDS: {
        لجنة_الرقابة:          '1484183210182185050',
        تظلم_على_عقوبة_ادارية: '1484183339236593744',
        بلاغ_ضد_مخرب:          '1484183390906220544',
        طلب_تعويض:             '1484183558951145534',
        تقديم_لاعب_معتمد:      '1484183823804661830',
        تقديم_صانع_محتوى:      '1484184026976882909',
        بلاغ_على_مشكلة_فنية:   '1484184288391073903',
        مساعدة_الموقع:          '1484184393739276411',
        حرس_الحدود:             '1484184479957385306',
        كراج_الميكانيكي:        '1484184570252365854',
        ادارة_الشرطة:           '1484184642251788308',
        الدفاع_المدني:          '1484184737701429248',
        امن_المنشآت:            '1484184894279127245',
        طلب_سكن:               '1484184997484302408',
        ادارة_الديسكورد:        '1484185082347388968'
    },
    ROLE_MENTIONS: {
        لجنة_الرقابة:          '1483512548753019032',
        تظلم_على_عقوبة_ادارية: '1483512544692928563',
        بلاغ_ضد_مخرب:          '1483512545573863564',
        طلب_تعويض:             '1483512546618118365',
        تقديم_لاعب_معتمد:      '1483512569883918446',
        تقديم_صانع_محتوى:      '1483512547738124318',
        بلاغ_على_مشكلة_فنية:   '1483512549717704876',
        مساعدة_الموقع:          '1483512481602343095',
        حرس_الحدود:             '1483512759365927102',
        كراج_الميكانيكي:        '1483512709625413702',
        ادارة_الشرطة:           '1483512641833140399',
        الدفاع_المدني:          '1483512674993176597',
        امن_المنشآت:            '1483512759365927102',
        طلب_سكن:               '1483512481602343095',
        ادارة_الديسكورد:        '1483512550921601206'
    }
};

// ==================== الألوان ====================
const COLORS = {
    PRIMARY: 0xFFD700,
    SUCCESS: 0x00FF00,
    DANGER:  0xFF0000,
    WARNING: 0xFFFF00,
    INFO:    0x5865F2
};

// ==================== قاعدة البيانات ====================
let ticketCounter = 1;
let stats = { totalCreated: 0, totalClosed: 0, totalRatings: 0, averageRating: 0, ratingSum: 0, staffStats: {} };

const db = {
    activeTickets:  new Map(),
    ticketData:     new Map(),
    claimedTickets: new Map(),
    cooldowns:      new Map(),
    blacklist:      new Set()
};

function loadData() {
    try {
        const data = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
        if (data.blacklist)    data.blacklist.forEach(id => db.blacklist.add(id));
        if (data.ticketCounter) ticketCounter = data.ticketCounter;
        if (data.activeTickets) for (const [k,v] of Object.entries(data.activeTickets)) db.activeTickets.set(k,v);
        if (data.ticketData)    for (const [k,v] of Object.entries(data.ticketData))    db.ticketData.set(k,v);
        if (data.claimedTickets) for (const [k,v] of Object.entries(data.claimedTickets)) db.claimedTickets.set(k,v);
    } catch(e) {}
    try {
        const s = JSON.parse(fs.readFileSync('./data/stats.json', 'utf8'));
        stats = { ...stats, ...s };
    } catch(e) {}
}

function saveData() {
    try {
        const obj = {
            blacklist: [...db.blacklist],
            ticketCounter,
            activeTickets:  Object.fromEntries(db.activeTickets),
            ticketData:     Object.fromEntries(db.ticketData),
            claimedTickets: Object.fromEntries(db.claimedTickets),
        };
        fs.writeFileSync('./database.json', JSON.stringify(obj, null, 2));
    } catch(e) {}
}

function saveStats() {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data');
        fs.writeFileSync('./data/stats.json', JSON.stringify(stats, null, 2));
    } catch(e) {}
}

function generateTicketNumber() {
    return ticketCounter++;
}

async function sendLog(embed, channelId) {
    const id = channelId || CONFIG.LOGS_CHANNEL_ID;
    if (!id) return;
    try {
        const ch = await client.channels.fetch(id).catch(() => null);
        if (ch) await ch.send({ embeds: [embed] });
    } catch(e) {}
}

function hasPermission(member) {
    if (!member) return false;
    if (!CONFIG.TICKET_ADMIN_ROLE_ID) return member.permissions.has(PermissionFlagsBits.Administrator);
    return member.roles.cache.has(CONFIG.TICKET_ADMIN_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);
}

function hasDeptPermission(member, ticketType) {
    if (!member) return false;
    if (hasPermission(member)) return true;
    const roleId = CONFIG.ROLE_MENTIONS[ticketType];
    if (roleId) return member.roles.cache.has(roleId);
    return false;
}

function getMention(ticketType) {
    const id = CONFIG.ROLE_MENTIONS[ticketType];
    return id ? `<@&${id}>` : '';
}

// ==================== نماذج التذاكر ====================
const ticketForms = {
    لجنة_الرقابة: {
        title: 'لجنة الرقابة', channelName: 'لجنة-الرقابة', emoji: '<:emoji_1:1483776808712278027>',
        fields: [
            { id: 'message_link',  label: ' رقم التذكرة السابقة', placeholder: 'ارفق رقم التذكرة السابقة', style: TextInputStyle.Short,     required: true,  minLength: 10 },
            { id: 'player_name',   label: ' اسم المشتكى عليه',    placeholder: 'ارفق جميع البيانات',        style: TextInputStyle.Short,     required: true,  minLength: 10 },
            { id: 'reason',        label: ' سبب الشكوى',           placeholder: 'هدفك وطلباتك',             style: TextInputStyle.Paragraph, required: true,  minLength: 10 },
            { id: 'problem_desc',  label: ' وصف المشكلة',          placeholder: 'اوصف المشكلة بالتفصيل',    style: TextInputStyle.Paragraph, required: true,  minLength: 10 },
            { id: 'evidence',      label: ' الأدلة',               placeholder: 'ارفق روابط الأدلة',        style: TextInputStyle.Paragraph, required: false, minLength: 10 }
        ]
    },
    تظلم_على_عقوبة_ادارية: {
        title: 'تظلم على عقوبة إدارية', channelName: 'تظلم-عقوبة', emoji: '<:emoji_2:1484191891581829302>',
        fields: [
            { id: 'your_name',         label: ' اسمك في السيرفر',   placeholder: 'إنجليزي فقط',            style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'punishment_details', label: ' تفاصيل العقوبة',   placeholder: 'نوع وتاريخ العقوبة',      style: TextInputStyle.Short,     required: true, minLength: 10 },
            { id: 'reason',            label: ' سبب التظلم',         placeholder: 'لماذا العقوبة غير عادلة؟', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'evidence',          label: ' الأدلة',             placeholder: 'روابط الفيديو أو الصور',  style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    بلاغ_ضد_مخرب: {
        title: 'بلاغ ضد مخرب', channelName: 'بلاغ-مخرب', emoji: '<:emoji_3:1483774749304950914>',
        fields: [
            { id: 'your_name',       label: ' اسم حسابك',      placeholder: 'إنجليزي فقط',              style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'report_date',     label: ' تاريخ المخالفة', placeholder: '2026/03/17',               style: TextInputStyle.Short,     required: true, minLength: 10 },
            { id: 'cheater_name',    label: ' اسم المخرب',     placeholder: 'اسم الشخص المخالف',        style: TextInputStyle.Short,     required: true, minLength: 4  },
            { id: 'clip_link',       label: ' رابط الدليل',    placeholder: 'يوتيوب 5 دقائق على الأقل', style: TextInputStyle.Short,     required: true, minLength: 10 },
            { id: 'cheater_summary', label: ' ملخص المخالفة',  placeholder: 'اشرح المخالفة',            style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    طلب_تعويض: {
        title: 'طلب تعويض', channelName: 'طلب-تعويض', emoji: '<:emoji_4:1483774749304950914>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك',       placeholder: 'إنجليزي فقط',  style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'amount',    label: ' المبلغ',           placeholder: 'المبلغ المطلوب', style: TextInputStyle.Short,     required: true, minLength: 1  },
            { id: 'reason',    label: ' سبب التعويض',      placeholder: 'كيف خسرت المبلغ؟', style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'evidence',  label: ' الأدلة',           placeholder: 'فيديو أو صور',  style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    تقديم_لاعب_معتمد: {
        title: 'تقديم لاعب معتمد', channelName: 'تقديم-معتمد', emoji: '<:emoji_5:1483777028309389433>',
        fields: [
            { id: 'real_name',   label: ' اسمك الحقيقي', placeholder: 'الاسم الكامل',         style: TextInputStyle.Short,     required: true, minLength: 4  },
            { id: 'real_age',    label: ' عمرك',          placeholder: 'عمرك الحقيقي',         style: TextInputStyle.Short,     required: true, minLength: 1  },
            { id: 'level',       label: ' مستواك',        placeholder: 'مستوى خبرتك + صورة',  style: TextInputStyle.Paragraph, required: true, minLength: 10 },
            { id: 'experience',  label: ' خبراتك',        placeholder: 'الوظائف السابقة',      style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    تقديم_صانع_محتوى: {
        title: 'تقديم صانع محتوى', channelName: 'تقديم-محتوى', emoji: '<:emoji_6:1483777249089032244>',
        fields: [
            { id: 'content_type', label: ' نوع المحتوى', placeholder: 'ستريمر - يوتيوبر - تيك توكر', style: TextInputStyle.Short, required: true, minLength: 4  },
            { id: 'channel_link', label: ' رابط القناة', placeholder: 'رابط المنصة',                 style: TextInputStyle.Short, required: true, minLength: 10 },
            { id: 'followers',    label: ' المتابعين',   placeholder: 'عدد المتابعين',               style: TextInputStyle.Short, required: true, minLength: 1  }
        ]
    },
    بلاغ_على_مشكلة_فنية: {
        title: 'بلاغ مشكلة فنية', channelName: 'مشكلة-فنية', emoji: '<:emoji_7:1483777089927647232>',
        fields: [
            { id: 'your_name',       label: ' اسم حسابك',    placeholder: 'إنجليزي فقط',          style: TextInputStyle.Short,     required: true,  minLength: 3  },
            { id: 'issue_type',      label: ' نوع المشكلة',  placeholder: 'لعبة / ديسكورد / موقع', style: TextInputStyle.Short,     required: true,  minLength: 4  },
            { id: 'issue_desc',      label: ' وصف المشكلة',  placeholder: 'اشرح بالتفصيل',         style: TextInputStyle.Paragraph, required: true,  minLength: 10 },
            { id: 'tried_solutions', label: ' ما حاولت',     placeholder: 'حلول جربتها',           style: TextInputStyle.Paragraph, required: false, minLength: 10 }
        ]
    },
    مساعدة_الموقع: {
        title: 'مساعدة الموقع', channelName: 'مساعدة-موقع', emoji: '<:emoji_8:1484012024810704926>',
        fields: [
            { id: 'your_name',    label: ' اسم حسابك', placeholder: 'إنجليزي فقط',    style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'order_number', label: ' رقم الطلب', placeholder: 'رقم الأوردر',     style: TextInputStyle.Short,     required: true, minLength: 1  },
            { id: 'issue',        label: ' المشكلة',   placeholder: 'اشرح المشكلة',    style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    حرس_الحدود: {
        title: 'حرس الحدود', channelName: 'حرس-الحدود', emoji: '<:emoji_9:1483775005971185796>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك',   placeholder: 'إنجليزي فقط',    style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'nickname',  label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short,     required: true, minLength: 4  },
            { id: 'issue',     label: ' الموضوع',      placeholder: 'اشرح بالتفصيل',  style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    كراج_الميكانيكي: {
        title: 'كراج الميكانيكي', channelName: 'كراج-ميكانيكي', emoji: '<:emoji_10:1483774649094377542>',
        fields: [
            { id: 'your_name',  label: ' اسم حسابك',      placeholder: 'إنجليزي فقط',    style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'nickname',   label: ' اسم الشخصية',    placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short,     required: true, minLength: 4  },
            { id: 'car_issue',  label: ' مشكلة السيارة',  placeholder: 'اشرح المشكلة',    style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    ادارة_الشرطة: {
        title: 'إدارة الشرطة', channelName: 'ادارة-شرطة', emoji: '<:emoji_11:1483774695294631976>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك',   placeholder: 'إنجليزي فقط',    style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'nickname',  label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short,     required: true, minLength: 4  },
            { id: 'issue',     label: ' الموضوع',      placeholder: 'اشرح بالتفصيل',  style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    الدفاع_المدني: {
        title: 'الدفاع المدني', channelName: 'دفاع-مدني', emoji: '<:emoji_12:1484518650160349356>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك',   placeholder: 'إنجليزي فقط',    style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'nickname',  label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short,     required: true, minLength: 4  },
            { id: 'issue',     label: ' الموضوع',      placeholder: 'اشرح بالتفصيل',  style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    امن_المنشآت: {
        title: 'أمن المنشآت', channelName: 'امن-منشآت', emoji: '<:emoji_13:1484304537119359026>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك',   placeholder: 'إنجليزي فقط',    style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'nickname',  label: ' اسم الشخصية', placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short,     required: true, minLength: 4  },
            { id: 'issue',     label: ' الموضوع',      placeholder: 'اشرح بالتفصيل',  style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    },
    طلب_سكن: {
        title: 'طلب سكن', channelName: 'طلب-سكن', emoji: '<:emoji_14:1483778359908368505>',
        fields: [
            { id: 'your_name',      label: ' اسم حسابك',      placeholder: 'إنجليزي فقط',    style: TextInputStyle.Short, required: true, minLength: 3 },
            { id: 'nickname',       label: ' اسم الشخصية',    placeholder: 'اسمك في السيرفر', style: TextInputStyle.Short, required: true, minLength: 4 },
            { id: 'family_name',    label: ' اسم العائلة',    placeholder: 'اسم العائلة',     style: TextInputStyle.Short, required: true, minLength: 4 },
            { id: 'house_location', label: ' موقع السكن',     placeholder: 'المكان المطلوب', style: TextInputStyle.Short, required: true, minLength: 4 }
        ]
    },
    ادارة_الديسكورد: {
        title: 'إدارة الديسكورد', channelName: 'ادارة-ديسكورد', emoji: '<:emoji_15:1484191828839497898>',
        fields: [
            { id: 'your_name', label: ' اسم حسابك', placeholder: 'اكتب اسمك',      style: TextInputStyle.Short,     required: true, minLength: 3  },
            { id: 'issue',     label: ' الموضوع',    placeholder: 'اشرح بالتفصيل', style: TextInputStyle.Paragraph, required: true, minLength: 10 }
        ]
    }
};

// ==================== الفويس ====================
let voiceConnection = null;

async function joinVoice(channelId) {
    if (!channelId) return;
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
        if (!guild) return;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildVoice) return;

        voiceConnection = joinVoiceChannel({
            channelId: channelId,
            guildId:   CONFIG.GUILD_ID,
            adapterCreator: guild.voiceAdapterCreator,
            selfMute:  false,
            selfDeaf:  true
        });

        voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch {
                setTimeout(() => joinVoice(channelId), 5000);
            }
        });

        voiceConnection.on('error', () => {
            setTimeout(() => joinVoice(channelId), 5000);
        });

        console.log(`✅ دخل الفويس: ${channel.name}`);
    } catch(e) {
        console.error('خطأ في الفويس:', e.message);
        setTimeout(() => joinVoice(channelId), 10000);
    }
}

// ==================== لوحة التحكم ====================
async function showDashboard(interaction, member) {
    const isAdmin = hasPermission(member);
    let tickets = [];

    for (const [channelId, data] of db.ticketData) {
        if (!isAdmin && !hasDeptPermission(member, data.type)) continue;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
            tickets.push({
                ...data, channel,
                claimedBy:   db.claimedTickets.get(channelId),
                claimedName: db.claimedTickets.get(channelId) ? `<@${db.claimedTickets.get(channelId)}>` : '⏳ قيد الانتظار'
            });
        }
    }

    tickets.sort((a,b) => (a.claimedBy ? 1 : -1) - (b.claimedBy ? 1 : -1) || b.createdAt - a.createdAt);

    const perPage = 5, totalPages = Math.ceil(tickets.length / perPage) || 1;
    let page = 0;

    const buildEmbed = (p) => {
        const slice = tickets.slice(p*perPage, p*perPage+perPage);
        const em = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('📊 لوحة تحكم التذاكر')
            .setDescription(`**إجمالي النشطة: ${tickets.length}**  |  ⏳ انتظار: **${tickets.filter(t=>!t.claimedBy).length}**  |  ✋ مستلمة: **${tickets.filter(t=>t.claimedBy).length}**`)
            .setFooter({ text: `صفحة ${p+1}/${totalPages} • Nexus RolePlay` })
            .setTimestamp();
        if (slice.length) {
            slice.forEach(t => em.addFields({
                name: `${t.claimedBy?'✅':'⏳'} #${t.ticketNumber} - ${ticketForms[t.type]?.title||t.type}`,
                value: `👤 <@${t.ownerId}>  |  ✋ ${t.claimedName}  |  ⏰ <t:${Math.floor(t.createdAt/1000)}:R>\n🔗 ${t.channel}`,
                inline: false
            }));
        } else {
            em.addFields({ name: '📭 لا توجد تذاكر', value: 'لا توجد تذاكر نشطة حالياً', inline: false });
        }
        return em;
    };

    const buildRows = (p) => {
        const rows = [];
        const nav = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`dp_${member.id}`).setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(p===0),
            new ButtonBuilder().setCustomId(`dn_${member.id}`).setLabel(`${p+1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId(`dx_${member.id}`).setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(p>=totalPages-1),
            new ButtonBuilder().setCustomId(`dr_${member.id}`).setLabel('🔄 تحديث').setStyle(ButtonStyle.Success)
        );
        rows.push(nav);
        if (isAdmin) {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`dba_${member.id}`).setLabel('🚫 إضافة للبلاك ليست').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`dbr_${member.id}`).setLabel('✅ إزالة من البلاك ليست').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`dbl_${member.id}`).setLabel('📋 قائمة البلاك ليست').setStyle(ButtonStyle.Secondary)
            ));
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ds_${member.id}`).setLabel('📊 الإحصائيات').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`dt_${member.id}`).setLabel('👑 أفضل الموظفين').setStyle(ButtonStyle.Primary)
            ));
        }
        return rows;
    };

    await interaction.deferReply({ ephemeral: true });
    const msg = await interaction.editReply({ embeds: [buildEmbed(page)], components: buildRows(page) });

    const col = msg.createMessageComponentCollector({ filter: i=>i.user.id===member.id, time: 600000 });

    col.on('collect', async i => {
        await i.deferUpdate().catch(()=>{});
        const id = i.customId;
        if (id===`dp_${member.id}`) { page--; await i.editReply({ embeds:[buildEmbed(page)], components:buildRows(page) }); }
        else if (id===`dx_${member.id}`) { page++; await i.editReply({ embeds:[buildEmbed(page)], components:buildRows(page) }); }
        else if (id===`dr_${member.id}`) { col.stop(); await showDashboard(interaction, member); }
        else if (id===`dba_${member.id}`) {
            const m = new ModalBuilder().setCustomId(`bl_add_${member.id}`).setTitle('🚫 إضافة للبلاك ليست');
            m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('uid').setLabel('الآيدي').setStyle(TextInputStyle.Short).setRequired(true)));
            await i.showModal(m);
        } else if (id===`dbr_${member.id}`) {
            const m = new ModalBuilder().setCustomId(`bl_rem_${member.id}`).setTitle('✅ إزالة من البلاك ليست');
            m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('uid').setLabel('الآيدي').setStyle(TextInputStyle.Short).setRequired(true)));
            await i.showModal(m);
        } else if (id===`dbl_${member.id}`) {
            const list = [...db.blacklist].map((x,n)=>`${n+1}. <@${x}> (${x})`).join('\n') || 'القائمة فارغة';
            await i.followUp({ embeds:[new EmbedBuilder().setColor(COLORS.DANGER).setTitle('🚫 البلاك ليست').setDescription(list).setTimestamp()], ephemeral:true });
        } else if (id===`ds_${member.id}`) {
            await i.followUp({ embeds:[new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle('📊 الإحصائيات')
                .addFields(
                    { name:'🎫 نشطة', value:`${db.activeTickets.size}`, inline:true },
                    { name:'🔒 مغلقة', value:`${stats.totalClosed||0}`, inline:true },
                    { name:'📈 إجمالي', value:`${stats.totalCreated||0}`, inline:true },
                    { name:'⭐ تقييمات', value:`${stats.totalRatings||0}`, inline:true },
                    { name:'⭐ متوسط', value:`${stats.averageRating?.toFixed(2)||0}/5`, inline:true },
                    { name:'🚫 بلاك ليست', value:`${db.blacklist.size}`, inline:true }
                ).setTimestamp()], ephemeral:true });
        } else if (id===`dt_${member.id}`) {
            const top = Object.entries(stats.staffStats||{}).map(([id,d])=>({id,tot:(d.claimed||0)+(d.closed||0),claimed:d.claimed||0,closed:d.closed||0})).sort((a,b)=>b.tot-a.tot).slice(0,10);
            const desc = top.length ? top.map((s,n)=>`${n+1}. <@${s.id}> | استلام: ${s.claimed} | إغلاق: ${s.closed}`).join('\n') : 'لا توجد بيانات';
            await i.followUp({ embeds:[new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle('👑 أفضل الموظفين').setDescription(desc).setTimestamp()], ephemeral:true });
        }
    });

    col.on('end', ()=>{
        try {
            interaction.editReply({ content:'⏰ انتهت الجلسة', components:[] }).catch(()=>{});
        } catch(e) {}
    });
}

// ==================== جاهز ====================
client.once('ready', async () => {
    loadData();
    console.log(`✅ Nexus Ticket System جاهز | ${client.user.tag}`);
    if (CONFIG.VOICE_CHANNEL_ID) {
        setTimeout(() => joinVoice(CONFIG.VOICE_CHANNEL_ID), 3000);
    }
});

// ==================== الأوامر ====================
client.on('messageCreate', async msg => {
    if (msg.author.bot || !msg.guild) return;
    const content = msg.content.trim();
    const member  = msg.member;

    // ==================== !مساعدة أو !help ====================
    if (content === '!مساعدة' || content === '!help') {
        const isAdmin = hasPermission(member);
        const em = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('📖 قائمة الأوامر')
            .setDescription('جميع أوامر بوت التذاكر')
            .addFields(
                { name: '!setup_ticket', value: 'ينشر لوحة فتح التذاكر في الروم الحالي *(للإدارة فقط)*', inline: false },
                { name: '!setup_dashboard', value: 'ينشر زر لوحة تحكم التذاكر *(للإدارة فقط)*', inline: false },
                { name: '!dashboard', value: 'يفتح لوحة تحكم التذاكر لك', inline: false },
                { name: '!voice [آيدي الروم]', value: 'يدخل البوت روم الصوت *(للإدارة فقط)*', inline: false },
                { name: '!stats', value: 'يعرض إحصائيات التذاكر *(للإدارة فقط)*', inline: false },
                { name: '!مساعدة أو !help', value: 'يعرض هذه القائمة', inline: false }
            )
            .setFooter({ text: 'Nexus RolePlay • Ticket System' })
            .setTimestamp();
        return msg.reply({ embeds: [em] });
    }

    // ==================== !setup_ticket ====================
    if (content === '!setup_ticket') {
        if (!hasPermission(member)) return msg.reply({ content: '❌ هذا الأمر للإدارة فقط', ephemeral: false });

        const em = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('🎫 Nexus RolePlay — نظام التذاكر')
            .setDescription(
                '**مرحباً بك في نظام التذاكر** 👋\n\n' +
                'اختر نوع التذكرة المناسب من القائمة أدناه وسيتواصل معك الفريق المختص\n\n' +
                '**⚠️ ملاحظات مهمة:**\n' +
                '• اختر القسم الصحيح لمشكلتك\n' +
                '• كن دقيقاً وواضحاً في شرح المشكلة\n' +
                '• أرفق الأدلة اللازمة\n' +
                '• لا تفتح أكثر من تذكرة لنفس الموضوع\n' +
                '• احترم قوانين السيرفر'
            )
            .setThumbnail(msg.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'Nexus RolePlay • Ticket System' })
            .setTimestamp();

        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu_main')
            .setPlaceholder('📩 اختر نوع التذكرة...')
            .addOptions(Object.entries(ticketForms).map(([key, data]) => ({
                label: data.title,
                value: key,
                emoji: data.emoji,
                description: `فتح تذكرة في قسم ${data.title}`
            })));

        await msg.channel.send({ embeds: [em], components: [new ActionRowBuilder().addComponents(select)] });
        await msg.delete().catch(()=>{});
        return;
    }

    // ==================== !setup_dashboard ====================
    if (content === '!setup_dashboard') {
        if (!hasPermission(member)) return msg.reply({ content: '❌ هذا الأمر للإدارة فقط' });

        const em = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('📊 لوحة تحكم التذاكر')
            .setDescription('اضغط على الزر أدناه لفتح لوحة التحكم\n\n*اللوحة خاصة بك فقط*')
            .setThumbnail(msg.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'Nexus RolePlay • Ticket System' })
            .setTimestamp();

        await msg.channel.send({ embeds: [em], components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_dashboard').setLabel('📊 فتح لوحة التحكم').setStyle(ButtonStyle.Primary).setEmoji('🎫')
        )] });
        await msg.delete().catch(()=>{});
        return;
    }

    // ==================== !dashboard ====================
    if (content === '!dashboard') {
        if (!hasPermission(member) && ![...db.ticketData.values()].some(t => hasDeptPermission(member, t.type))) {
            return msg.reply({ content: '❌ ليس لديك صلاحية' });
        }
        const fake = {
            user: msg.author, member, guild: msg.guild,
            deferred: false, replied: false,
            deferReply: async () => { fake.deferred = true; return msg; },
            editReply:  async (o) => msg.reply(o),
            followUp:   async (o) => msg.reply(o)
        };
        await showDashboard(fake, member);
        await msg.delete().catch(()=>{});
        return;
    }

    // ==================== !voice ====================
    if (content.startsWith('!voice')) {
        if (!hasPermission(member)) return msg.reply({ content: '❌ هذا الأمر للإدارة فقط' });
        const parts = content.split(' ');
        const channelId = parts[1] || CONFIG.VOICE_CHANNEL_ID;
        if (!channelId) return msg.reply({ content: '❌ حدد آيدي الروم الصوتي: `!voice [آيدي الروم]`' });
        await joinVoice(channelId);
        await msg.reply({ content: `✅ جاري الانضمام للروم الصوتي...` });
        return;
    }

    // ==================== !stats ====================
    if (content === '!stats') {
        if (!hasPermission(member)) return msg.reply({ content: '❌ هذا الأمر للإدارة فقط' });
        const em = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('📊 إحصائيات نظام التذاكر')
            .addFields(
                { name: '🎫 تذاكر نشطة', value: `${db.activeTickets.size}`, inline: true },
                { name: '✋ مستلمة',      value: `${db.claimedTickets.size}`, inline: true },
                { name: '🔒 مغلقة',       value: `${stats.totalClosed||0}`, inline: true },
                { name: '📈 إجمالي',      value: `${stats.totalCreated||0}`, inline: true },
                { name: '⭐ تقييمات',    value: `${stats.totalRatings||0}`, inline: true },
                { name: '⭐ متوسط',      value: `${stats.averageRating?.toFixed(2)||0}/5`, inline: true },
                { name: '🚫 بلاك ليست',  value: `${db.blacklist.size}`, inline: true }
            )
            .setTimestamp();
        return msg.reply({ embeds: [em] });
    }
});

// ==================== التفاعلات ====================
client.on('interactionCreate', async interaction => {

    // ==================== ⭐ التقييم (يجب أن يكون أول شيء - يأتي من DM) ====================
    if (interaction.isButton() && interaction.customId.startsWith('rate_')) {
        try {
            const parts = interaction.customId.split('_');
            if (parts.length < 4) return await interaction.reply({ content: '❌ خطأ في التقييم', ephemeral: true });

            const ticketNum = parts[1];
            const ownerId   = parts[2];
            const rating    = parseInt(parts[3]);

            if (interaction.user.id !== ownerId)
                return await interaction.reply({ content: '❌ فقط صاحب التذكرة يمكنه التقييم!', ephemeral: true });
            if (isNaN(rating) || rating < 1 || rating > 5)
                return await interaction.reply({ content: '❌ تقييم غير صالح', ephemeral: true });

            await interaction.deferUpdate();

            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('⭐ شكراً لتقييمك!')
                    .setDescription(`تقييمك: **${'⭐'.repeat(rating)} (${rating}/5)**\n\nنشكرك على استخدام نظام التذاكر`)
                    .setTimestamp()],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('rated').setLabel(`✅ تم التقييم: ${rating}/5`).setStyle(ButtonStyle.Success).setDisabled(true)
                )]
            });

            const ratingEmbed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('⭐ تقييم جديد')
                .addFields(
                    { name: '🎫 رقم التذكرة', value: `#${ticketNum}`, inline: true },
                    { name: '⭐ التقييم',      value: `${'⭐'.repeat(rating)} (${rating}/5)`, inline: true },
                    { name: '👤 المستخدم',     value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📅 التاريخ',      value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: 'Nexus RolePlay • نظام التقييمات' })
                .setTimestamp();

            await sendLog(ratingEmbed, CONFIG.RATINGS_CHANNEL_ID);

            stats.totalRatings = (stats.totalRatings||0) + 1;
            stats.ratingSum    = (stats.ratingSum||0) + rating;
            stats.averageRating = stats.ratingSum / stats.totalRatings;
            saveStats();
        } catch(e) {
            console.error('خطأ في التقييم:', e.message);
            if (!interaction.replied && !interaction.deferred)
                await interaction.reply({ content: '❌ حدث خطأ في التقييم', ephemeral: true }).catch(()=>{});
        }
        return;
    }

    // ==================== زر فتح لوحة التحكم ====================
    if (interaction.isButton() && interaction.customId === 'open_dashboard') {
        if (!hasPermission(interaction.member)) {
            return interaction.reply({ content: '❌ ليس لديك صلاحية', ephemeral: true });
        }
        return showDashboard(interaction, interaction.member);
    }

    // ==================== Blacklist modals ====================
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.includes('bl_add_')) {
        const uid = interaction.fields.getTextInputValue('uid').replace(/[<@!>]/g,'');
        try {
            await client.users.fetch(uid);
            if (db.blacklist.has(uid)) return interaction.reply({ content:'❌ موجود مسبقاً', ephemeral:true });
            db.blacklist.add(uid); saveData();
            await sendLog(new EmbedBuilder().setColor(COLORS.DANGER).setTitle('🚫 إضافة للبلاك ليست')
                .addFields({name:'المستخدم',value:`<@${uid}>`},{name:'بواسطة',value:`<@${interaction.user.id}>`}).setTimestamp());
            return interaction.reply({ content:`✅ تم إضافة <@${uid}> للبلاك ليست`, ephemeral:true });
        } catch { return interaction.reply({ content:'❌ المستخدم غير موجود', ephemeral:true }); }
    }

    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.includes('bl_rem_')) {
        const uid = interaction.fields.getTextInputValue('uid').replace(/[<@!>]/g,'');
        if (!db.blacklist.has(uid)) return interaction.reply({ content:'❌ ليس في البلاك ليست', ephemeral:true });
        db.blacklist.delete(uid); saveData();
        await sendLog(new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('✅ إزالة من البلاك ليست')
            .addFields({name:'المستخدم',value:`<@${uid}>`},{name:'بواسطة',value:`<@${interaction.user.id}>`}).setTimestamp());
        return interaction.reply({ content:`✅ تم إزالة <@${uid}> من البلاك ليست`, ephemeral:true });
    }

    // ==================== قائمة التذاكر ====================
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu_main') {
        if (db.blacklist.has(interaction.user.id))
            return interaction.reply({ content:'🚫 أنت محظور من فتح التذاكر', ephemeral:true });

        const cooldown = db.cooldowns.get(interaction.user.id);
        if (cooldown && Date.now() - cooldown < 60000) {
            const rem = Math.ceil((60000-(Date.now()-cooldown))/1000);
            return interaction.reply({ content:`⏳ انتظر ${rem} ثانية`, ephemeral:true });
        }

        const key  = interaction.values[0];
        const form = ticketForms[key];
        if (!form) return interaction.reply({ content:'❌ نوع غير موجود', ephemeral:true });

        const em = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle(`${form.emoji} ${form.title}`)
            .setDescription('سيتم فتح تذكرة جديدة، اضغط **تأكيد** لملء النموذج')
            .addFields({ name:'⚠️ تنبيه', value:'• تأكد من اختيارك الصحيح\n• أرفق جميع الأدلة\n• عدم الرد = إغلاق تلقائي' })
            .setTimestamp();

        return interaction.reply({ embeds:[em], components:[new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_${key}`).setLabel('✅ تأكيد').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_ticket').setLabel('❌ إلغاء').setStyle(ButtonStyle.Danger)
        )], ephemeral:true });
    }

    // ==================== زر تأكيد ====================
    if (interaction.isButton() && interaction.customId.startsWith('confirm_')) {
        const key  = interaction.customId.replace('confirm_','');
        const form = ticketForms[key];
        if (!form) return interaction.reply({ content:'❌ خطأ', ephemeral:true });

        const modal = new ModalBuilder().setCustomId(`modal_${key}`).setTitle(form.title);
        modal.addComponents(...form.fields.slice(0,5).map(f =>
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setPlaceholder(f.placeholder)
                    .setStyle(f.style).setRequired(f.required).setMinLength(f.minLength||1)
            )
        ));
        return interaction.showModal(modal);
    }

    // ==================== إلغاء ====================
    if (interaction.isButton() && interaction.customId === 'cancel_ticket') {
        return interaction.update({ content:'❌ تم الإلغاء', embeds:[], components:[] });
    }

    // ==================== Modal فتح التذكرة ====================
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('modal_')) {
        const key     = interaction.customId.replace('modal_','');
        const form    = ticketForms[key];
        const member  = interaction.member;
        const guild   = interaction.guild;
        if (!form || !member || !guild) return interaction.reply({ content:'❌ خطأ', ephemeral:true });

        const responses = {};
        for (const f of form.fields) {
            const val = interaction.fields.getTextInputValue(f.id).trim();
            if (f.required && val.length < (f.minLength||1))
                return interaction.reply({ content:`❌ حقل "${f.label}" يحتاج ${f.minLength||1}+ حروف`, ephemeral:true });
            responses[f.id] = val;
        }

        const num  = generateTicketNumber();
        const name = `${num}-${form.channelName}`;

        try {
            const perms = [
                { id: guild.id,       deny:[PermissionFlagsBits.ViewChannel] },
                { id: member.id,      allow:[PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                { id: client.user.id, allow:[PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ];
            if (CONFIG.TICKET_ADMIN_ROLE_ID)
                perms.push({ id:CONFIG.TICKET_ADMIN_ROLE_ID, allow:[PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
            const roleId = CONFIG.ROLE_MENTIONS[key];
            if (roleId) perms.push({ id:roleId, allow:[PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

            const ch = await guild.channels.create({
                name, type:ChannelType.GuildText,
                parent: CONFIG.CATEGORY_IDS[key] || null,
                permissionOverwrites: perms,
                topic: `🎫 #${num} | ${form.title}`
            });

            const info = { channelId:ch.id, ticketNumber:num, type:key, ownerId:member.id, createdAt:Date.now() };
            db.activeTickets.set(member.id, info);
            db.ticketData.set(ch.id, info);
            db.cooldowns.set(member.id, Date.now());
            saveData();
            stats.totalCreated = (stats.totalCreated||0)+1; saveStats();

            const em = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle(`${form.emoji} تذكرة #${num} — ${form.title}`)
                .addFields(
                    { name:'👤 صاحب التذكرة', value:`<@${member.id}>`, inline:true },
                    { name:'📋 الحالة', value:'⏳ قيد الانتظار', inline:true },
                    { name:'⏰ الوقت', value:`<t:${Math.floor(Date.now()/1000)}:R>`, inline:true },
                    { name:'📄 المعلومات', value:form.fields.map(f=>`**${f.label}:**\n\`\`\`${responses[f.id]||'-'}\`\`\``).join('\n') }
                )
                .setThumbnail(guild.iconURL({ dynamic:true }))
                .setFooter({ text:`Nexus RolePlay • #${num}`, iconURL:guild.iconURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('✋ استلام').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rename_ticket').setLabel('✏️ تغيير الاسم').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('add_user').setLabel('➕ إضافة عضو').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('delete_ticket').setLabel('🗑️ حذف').setStyle(ButtonStyle.Danger)
            );

            const mention = getMention(key);
            await ch.send({
                content:`${mention}${mention?' ':''}\nتذكرة جديدة 🎫 | صاحبها: <@${member.id}>\nيرجى الصبر وعدم منشن الإدارة ⌛`,
                embeds:[em], components:[row]
            });

            try {
                await member.send({ embeds:[new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('✅ تم فتح تذكرتك')
                    .setDescription(`تذكرتك في قسم **${form.title}**`)
                    .addFields({name:'🎫 الرقم',value:`#${num}`,inline:true},{name:'📍 القناة',value:`${ch}`,inline:true})
                    .setFooter({text:'Nexus RolePlay'}).setTimestamp()] });
            } catch(e) {}

            await sendLog(new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('🎫 تذكرة جديدة')
                .addFields(
                    {name:'الرقم',value:`#${num}`,inline:true},
                    {name:'النوع',value:form.title,inline:true},
                    {name:'الصاحب',value:`<@${member.id}>`,inline:true},
                    {name:'القناة',value:`${ch}`,inline:true}
                ).setTimestamp());

            return interaction.reply({ content:`✅ تم فتح تذكرتك: ${ch}`, ephemeral:true });

        } catch(e) {
            console.error('خطأ في فتح التذكرة:', e.message);
            return interaction.reply({ content:'❌ حدث خطأ، حاول مجدداً', ephemeral:true });
        }
    }

    // ==================== أزرار السيرفر ====================
    if (interaction.isButton() && interaction.guildId) {
        const member    = interaction.member;
        const ticketInfo = db.ticketData.get(interaction.channel?.id);
        const ticketType = ticketInfo?.type;
        const perm       = hasDeptPermission(member, ticketType);

        if (interaction.customId === 'add_user') {
            if (!perm) return interaction.reply({ content:'❌ ليس لديك صلاحية', ephemeral:true });
            const m = new ModalBuilder().setCustomId('add_user_modal').setTitle('➕ إضافة عضو');
            m.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('uid').setLabel('آيدي العضو').setStyle(TextInputStyle.Short).setRequired(true)
            ));
            return interaction.showModal(m);
        }

        if (!perm && ['claim_ticket','close_ticket','rename_ticket','delete_ticket'].includes(interaction.customId))
            return interaction.reply({ content:'❌ ليس لديك صلاحية', ephemeral:true });

        if (interaction.customId === 'claim_ticket') {
            const chId = interaction.channel.id;
            if (db.claimedTickets.has(chId)) {
                const by = db.claimedTickets.get(chId);
                return interaction.reply({ content: by===interaction.user.id ? '✅ أنت مستلمها!' : `❌ مستلمة من <@${by}>`, ephemeral:true });
            }
            db.claimedTickets.set(chId, interaction.user.id); saveData();
            stats.staffStats[interaction.user.id] = stats.staffStats[interaction.user.id]||{claimed:0,closed:0};
            stats.staffStats[interaction.user.id].claimed++; saveStats();
            try {
                const msgs = await interaction.channel.messages.fetch({ limit:10 });
                const bm = msgs.find(m=>m.author.id===client.user.id&&m.embeds.length>0);
                if (bm) {
                    const old = bm.embeds[0];
                    const upd = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle(old.title).setDescription(old.description)
                        .setThumbnail(old.thumbnail?.url||null).setFooter(old.footer||null).setTimestamp();
                    old.fields.forEach(f => f.name==='📋 الحالة'
                        ? upd.addFields({name:'📋 الحالة',value:`✅ مستلمة من <@${interaction.user.id}>`,inline:true})
                        : upd.addFields({name:f.name,value:f.value,inline:f.inline})
                    );
                    await bm.edit({ embeds:[upd] });
                }
            } catch(e) {}
            await sendLog(new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle('✋ استلام تذكرة')
                .addFields({name:'الرقم',value:`#${ticketInfo?.ticketNumber||'?'}`,inline:true},{name:'بواسطة',value:`<@${interaction.user.id}>`,inline:true}).setTimestamp());
            return interaction.reply({ content:'✅ تم الاستلام، بالتوفيق!', ephemeral:true });
        }

        if (interaction.customId === 'close_ticket') {
            const m = new ModalBuilder().setCustomId('close_modal').setTitle('🔒 سبب الإغلاق');
            m.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('reason').setLabel('السبب').setStyle(TextInputStyle.Paragraph).setRequired(true)
            ));
            return interaction.showModal(m);
        }

        if (interaction.customId === 'rename_ticket') {
            const m = new ModalBuilder().setCustomId('rename_modal').setTitle('✏️ تغيير اسم التذكرة');
            m.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('name').setLabel('الاسم الجديد').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90)
            ));
            return interaction.showModal(m);
        }

        if (interaction.customId === 'delete_ticket') {
            const m = new ModalBuilder().setCustomId('delete_modal').setTitle('🗑️ تأكيد الحذف');
            m.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('confirm').setLabel('اكتب كلمة "حذف" للتأكيد').setPlaceholder('حذف').setStyle(TextInputStyle.Short).setRequired(true)
            ));
            return interaction.showModal(m);
        }
    }

    // ==================== Modal إضافة عضو ====================
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'add_user_modal') {
        const info = db.ticketData.get(interaction.channel.id);
        if (!hasDeptPermission(interaction.member, info?.type)) return interaction.reply({ content:'❌ ليس لديك صلاحية', ephemeral:true });
        const uid = interaction.fields.getTextInputValue('uid');
        try {
            const target = await interaction.guild.members.fetch(uid);
            await interaction.channel.permissionOverwrites.create(target, {
                ViewChannel:true, SendMessages:true, ReadMessageHistory:true, AttachFiles:true
            });
            await interaction.channel.send({ embeds:[new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`➕ تم إضافة <@${target.id}>`).setTimestamp()] });
            await sendLog(new EmbedBuilder().setColor(COLORS.INFO).setTitle('➕ إضافة عضو')
                .addFields({name:'المضاف',value:`<@${target.id}>`,inline:true},{name:'بواسطة',value:`<@${interaction.user.id}>`,inline:true}).setTimestamp());
            return interaction.reply({ content:'✅ تم', ephemeral:true });
        } catch { return interaction.reply({ content:'❌ لم يتم العثور على العضو', ephemeral:true }); }
    }

    // ==================== Modal تغيير الاسم ====================
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'rename_modal') {
        const newName = interaction.fields.getTextInputValue('name');
        const old     = interaction.channel.name;
        try {
            await interaction.channel.setName(newName);
            await interaction.channel.send({ embeds:[new EmbedBuilder().setColor(COLORS.WARNING).setDescription(`✏️ تغيير الاسم: \`${old}\` → \`${newName}\``).setTimestamp()] });
            return interaction.reply({ content:'✅ تم تغيير الاسم', ephemeral:true });
        } catch { return interaction.reply({ content:'❌ خطأ في تغيير الاسم', ephemeral:true }); }
    }

    // ==================== Modal حذف التذكرة ====================
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'delete_modal') {
        if (interaction.fields.getTextInputValue('confirm') !== 'حذف')
            return interaction.reply({ content:'❌ لم يتم التأكيد', ephemeral:true });
        const ch   = interaction.channel;
        const info = db.ticketData.get(ch.id);
        if (info?.ownerId) db.activeTickets.delete(info.ownerId);
        db.ticketData.delete(ch.id); db.claimedTickets.delete(ch.id); saveData();
        await sendLog(new EmbedBuilder().setColor(COLORS.DANGER).setTitle('🗑️ حذف تذكرة')
            .addFields({name:'القناة',value:ch.name,inline:true},{name:'بواسطة',value:`<@${interaction.user.id}>`,inline:true}).setTimestamp());
        await interaction.reply({ embeds:[new EmbedBuilder().setColor(COLORS.DANGER).setDescription(`🗑️ تم حذف التذكرة بواسطة <@${interaction.user.id}>`).setTimestamp()] });
        setTimeout(()=>ch.delete().catch(()=>{}), 3000);
    }

    // ==================== Modal إغلاق التذكرة ====================
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'close_modal') {
        const reason  = interaction.fields.getTextInputValue('reason');
        const ch      = interaction.channel;
        const info    = db.ticketData.get(ch.id);
        const ownerId = info?.ownerId;
        const num     = info?.ticketNumber||'?';

        try { await ch.permissionOverwrites.edit(ch.guild.roles.everyone, { SendMessages:false }); } catch(e) {}
        if (ownerId) try { await ch.permissionOverwrites.edit(ownerId, { SendMessages:false }); } catch(e) {}

        const locked = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('_c1').setLabel('✋ مستلمة').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('_c2').setLabel('🔒 مغلقة').setStyle(ButtonStyle.Danger).setDisabled(true),
            new ButtonBuilder().setCustomId('_c3').setLabel('✏️ تغيير').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('add_user').setLabel('➕ إضافة').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('delete_ticket').setLabel('🗑️ حذف').setStyle(ButtonStyle.Danger)
        );
        try {
            const msgs = await ch.messages.fetch({ limit:10 });
            const bm = msgs.find(m=>m.author.id===client.user.id&&m.components.length>0);
            if (bm) await bm.edit({ components:[locked] });
        } catch(e) {}

        await interaction.reply({ embeds:[new EmbedBuilder().setColor(COLORS.DANGER).setTitle('🔒 إغلاق التذكرة')
            .addFields({name:'📝 السبب',value:reason},{name:'👤 أغلقها',value:`<@${interaction.user.id}>`}).setTimestamp()] });

        await sendLog(new EmbedBuilder().setColor(COLORS.DANGER).setTitle('🔒 إغلاق تذكرة')
            .addFields(
                {name:'الرقم',value:`#${num}`,inline:true},
                {name:'السبب',value:reason,inline:true},
                {name:'بواسطة',value:`<@${interaction.user.id}>`,inline:true}
            ).setTimestamp());

        if (ownerId) {
            const owner = await client.users.fetch(ownerId).catch(()=>null);
            if (owner) {
                await owner.send({ embeds:[new EmbedBuilder().setColor(COLORS.DANGER).setTitle('🔒 تم إغلاق تذكرتك')
                    .setDescription(`تذكرتك **#${num}** تم إغلاقها`)
                    .addFields({name:'السبب',value:reason},{name:'بواسطة',value:`<@${interaction.user.id}>`}).setTimestamp()] }).catch(()=>{});

                await owner.send({ embeds:[new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle('⭐ تقييم الخدمة')
                    .setDescription('كيف كانت تجربتك مع فريق الدعم؟\nاضغط على عدد النجوم للتقييم:')],
                    components:[new ActionRowBuilder().addComponents(
                        ...[1,2,3,4,5].map(n =>
                            new ButtonBuilder().setCustomId(`rate_${num}_${ownerId}_${n}`).setLabel(`${n}`).setStyle(ButtonStyle.Secondary).setEmoji('⭐')
                        )
                    )] }).catch(()=>{});
            }
            db.activeTickets.delete(ownerId); db.claimedTickets.delete(ch.id); saveData();
            stats.totalClosed = (stats.totalClosed||0)+1;
            stats.staffStats[interaction.user.id] = stats.staffStats[interaction.user.id]||{claimed:0,closed:0};
            stats.staffStats[interaction.user.id].closed++; saveStats();
        }

        if (CONFIG.TRANSCRIPT_CHANNEL_ID) {
            try {
                const msgs = await ch.messages.fetch({ limit:100 });
                const sorted = [...msgs.values()].reverse().filter(m=>!m.author.bot);
                let html = `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تذكرة #${num}</title>
                <style>body{background:#1A1A1A;color:#FFD700;font-family:Segoe UI;padding:20px}
                .msg{background:#2D2D2D;padding:10px;margin:5px 0;border-radius:5px}
                .author{color:#FFD700;font-weight:bold}.time{color:#888;font-size:.8em}</style></head><body>
                <h1>🎫 تذكرة #${num} - ${ch.name}</h1>`;
                sorted.forEach(m=>{
                    html+=`<div class="msg"><span class="author">${m.author.tag}</span> <span class="time">${m.createdAt.toLocaleString('ar-SA')}</span><p>${m.content.replace(/</g,'&lt;')}</p></div>`;
                });
                html+='</body></html>';
                const tch = await client.channels.fetch(CONFIG.TRANSCRIPT_CHANNEL_ID).catch(()=>null);
                if (tch) await tch.send({ content:`📝 ترانسكربت #${num}`, files:[{ attachment:Buffer.from(html), name:`ticket-${ch.name}.html` }] });
            } catch(e) {}
        }
    }
});

// ==================== تنظيف ====================
setInterval(() => {
    for (const [uid, data] of db.activeTickets) {
        if (!client.channels.cache.get(data.channelId)) {
            db.activeTickets.delete(uid);
            db.ticketData.delete(data.channelId);
            db.claimedTickets.delete(data.channelId);
        }
    }
    saveData();
}, 300000);

process.on('SIGINT',  () => { saveData(); process.exit(0); });
process.on('SIGTERM', () => { saveData(); process.exit(0); });
process.on('unhandledRejection', e => console.error('Unhandled:', e?.message));
process.on('uncaughtException',  e => { console.error('Uncaught:', e?.message); saveData(); });

client.login(CONFIG.TOKEN);
