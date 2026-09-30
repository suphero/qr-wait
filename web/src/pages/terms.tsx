import type { ReactNode } from "react";
import { LEGAL, LegalPage, Mail, siteUrl, type Section } from "@/components/legal";
import { pick } from "@/lib/i18n";
import { mount } from "@/lib/mount";

// Kullanım Koşulları: hesap sahipleri (sıra kuran işletmeler) için. Bilet, sıra sınırı ve iade kuralları
// src/billing.js ve src/index.js (FREE, ROOM_LIMIT) ile aynı olmalı; değişirse dört dilde de güncellenmeli.
const Privacy = ({ children }: { children: ReactNode }) => <a href={siteUrl("/privacy")}>{children}</a>;

const S: Section[] = pick<Section[]>({
  tr: [
    { h: "Taraflar ve kapsam", p: [<>Bu koşullar, Sıran Geldi (sirangeldi.com) sıra hizmetinde hesap açan kişi ya da kuruluşlar ("Hesap Sahibi") ile Sıran Geldi arasındaki ilişkiyi düzenler. Hesap açarak bu koşulları ve <Privacy>Gizlilik Politikası</Privacy>'nı kabul etmiş olursunuz. Sıraya giren ziyaretçiler hesap açmaz; onlar için yalnızca gizlilik politikası geçerlidir.</>] },
    { h: "Hesap", ul: [
      <>Hesap açan kişi 18 yaşından büyük olmalı; bir kuruluş adına açıyorsa o kuruluşu temsile yetkili olmalıdır.</>,
      <>Verdiğiniz bilgiler doğru olmalıdır; e-posta adresiniz doğrulanmadan sıra açamazsınız.</>,
      <>Şifrenizin güvenliğinden siz sorumlusunuz. Hesabınızın izinsiz kullanıldığını fark ederseniz şifrenizi değiştirip bize bildirin.</>,
      <>Ücretsiz bilet hakkından birden fazla yararlanmak için birden çok hesap açmak yasaktır.</>,
    ] },
    { h: "Hizmet ve bilet hakkı", ul: [
      <><b>Bilet:</b> sıralarınıza giren her yeni kayıt (QR koduyla ya da görevlinin elle eklemesiyle) 1 bilet harcar. Bir grup tek bilettir; aynı telefonun tekrar girişi yeni bilet harcamaz.</>,
      <><b>Ücretsiz hak:</b> her yeni hesaba bir kez 1.000 bilet ücretsiz tanımlanır.</>,
      <><b>Paketler:</b> ücretsiz hak bitince yönetim ekranından bilet paketi alabilirsiniz; güncel paketler ve fiyatlar orada gösterilir.</>,
      <><b>Süre:</b> satın alınan biletlerin son kullanma tarihi yoktur; hizmet sürdüğü ve hesabınız açık olduğu sürece kullanılabilir.</>,
      <><b>Bakiye bitince:</b> sıralarınız yeni kişi almaz, sıradaki kayıtlar etkilenmez. Bakiyeniz azaldığında ve bittiğinde e-postayla bilgilendirilirsiniz.</>,
      <>Kendi açtığınız hesapta en fazla 20 sıra oluşturabilirsiniz; daha fazlası için bize yazın.</>,
    ] },
    { h: "Ödeme, fatura ve iade", ul: [
      <>Ödemeler Lemon Squeezy üzerinden alınır. Lemon Squeezy satıcı (merchant of record) olarak satışı gerçekleştirir, faturayı düzenler ve geçerli vergileri tahsil eder; satın alırken Lemon Squeezy'nin alıcı koşulları da geçerlidir.</>,
      <>Fiyat değişiklikleri daha önce satın alınmış biletleri etkilemez.</>,
      <><b>İade:</b> hiç kullanılmamış bir paket, satın alma tarihinden itibaren 14 gün içinde <Mail /> adresine yazılarak iade edilebilir. Kısmen kullanılmış paketler ve ücretsiz haklar iade edilmez; iade edilen paketin biletleri hesaptan düşülür.</>,
      <>Tüketici sıfatıyla satın alanların 6502 sayılı Tüketicinin Korunması Hakkında Kanun'dan doğan hakları saklıdır.</>,
    ] },
    { h: "Hesap Sahibinin yükümlülükleri", ul: [
      <>Hizmeti yasalara uygun kullanırsınız. Sıra adları ve adresleri yanıltıcı olamaz, başka bir kişi, kurum ya da markayı taklit edemez, hakaret, spam ya da yasa dışı içerik barındıramaz.</>,
      <>Sıralarınıza giren ziyaretçilerin verileri bakımından veri sorumlusu sizsiniz; ziyaretçilerinizi gerektiğinde aydınlatmak (ör. sıra noktasında bilgilendirme) sizin sorumluluğunuzdadır. Sıran Geldi bu verileri yalnızca sizin adınıza, hizmetin çalışması için işler.</>,
      <>Görevli bağlantılarını yalnızca yetkili kişilerle paylaşırsınız; bağlantı sızarsa yönetim ekranından yenileyin.</>,
      <>Hizmetin güvenliğini ya da diğer kullanıcıları etkileyecek şekilde otomatik istek göndermek, sistemi aşmaya ya da tersine mühendisliğe çalışmak yasaktır.</>,
    ] },
    { h: "Uygun olmayan kullanım", p: [<>Sıran Geldi bir sıra düzenleme aracıdır. Acil sağlık hizmetlerinde önceliklendirme (triyaj) gibi can güvenliğini doğrudan etkileyen kararlar için tek başına kullanılmamalıdır; internet, telefon ya da konum hizmetlerindeki aksaklıklar sıranın işleyişini etkileyebilir.</>] },
    { h: "Askıya alma ve fesih", ul: [
      <>Bu koşulların ihlali, kötüye kullanım ya da yasal zorunluluk hâlinde hesabınızı önceden bildirerek, acil durumlarda derhal askıya alabilir ya da kapatabiliriz. Askıdaki hesabın sıraları haritadan kalkar ve yeni kişi almaz.</>,
      <>Hesabınızı dilediğiniz zaman yönetim ekranından silebilirsiniz; önce sıralarınızı silmeniz gerekir. Silinen hesabın kalan biletleri iade edilmez (14 günlük iade hakkı saklıdır).</>,
    ] },
    { h: "Hizmet düzeyi ve sorumluluk", ul: [
      <>Hizmeti kesintisiz ve hatasız sunmak için makul çabayı gösteririz; bakım, altyapı sağlayıcılarındaki arızalar ya da elimizde olmayan nedenlerle kesinti yaşanabilir. Hizmet "olduğu gibi" sunulur.</>,
      <>Yasanın izin verdiği ölçüde dolaylı zararlardan, kâr kaybından ve ziyaretçilerle aranızdaki uyuşmazlıklardan sorumlu değiliz. Tüketici olmayan Hesap Sahiplerine karşı toplam sorumluluğumuz, son 12 ayda bize ödenen tutarla sınırlıdır.</>,
      <>Kasıt ve ağır ihmalden doğan sorumluluk ile tüketicilerin yasal hakları saklıdır.</>,
    ] },
    { h: "Fikrî mülkiyet", p: [<>Sıran Geldi yazılımı, adı ve logosu bize aittir. Girdiğiniz içerik (sıra adı vb.) size aittir; hizmeti sunabilmemiz için bu içeriği gösterme hakkını bize tanırsınız.</>] },
    { h: "Değişiklikler", p: [<>Bu koşulları güncelleyebiliriz. Önemli değişiklikleri yürürlüğe girmeden en az 15 gün önce e-postayla bildiririz; sonrasında hizmeti kullanmaya devam etmeniz yeni koşulları kabul ettiğiniz anlamına gelir.</>] },
    { h: "Uygulanacak hukuk", p: [<>Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır ve uyuşmazlıklarda Türkiye Cumhuriyeti mahkemeleri ve icra daireleri yetkilidir. Tüketicilerin tüketici hakem heyetlerine ve tüketici mahkemelerine başvuru hakkı saklıdır.</>] },
    { h: "İletişim", p: [<>Sorularınız için: <Mail /></>] },
  ],
  en: [
    { h: "Parties and scope", p: [<>These terms govern the relationship between Sıran Geldi (sirangeldi.com) and the people or organisations who open an account for its queue service ("Account Holders"). By signing up you accept these terms and the <Privacy>Privacy Policy</Privacy>. Visitors joining a queue don't open an account; only the privacy policy applies to them.</>] },
    { h: "Account", ul: [
      <>You must be over 18 and, if signing up for an organisation, authorised to represent it.</>,
      <>Your information must be accurate; you can't create queues until your email is verified.</>,
      <>You are responsible for keeping your password safe. If you notice unauthorised use, change your password and let us know.</>,
      <>Opening several accounts to claim the free tickets more than once is prohibited.</>,
    ] },
    { h: "Service and tickets", ul: [
      <><b>Ticket:</b> every new entry in your queues (by QR code or added by an attendant) uses 1 ticket. A group is one ticket; the same phone joining again doesn't use a new one.</>,
      <><b>Free tickets:</b> each new account receives 1,000 free tickets once.</>,
      <><b>Packs:</b> when the free tickets run out you can buy ticket packs in the admin panel, where current packs and prices are shown.</>,
      <><b>Validity:</b> purchased tickets don't expire; they can be used as long as the service runs and your account is open.</>,
      <><b>When the balance runs out:</b> your queues stop accepting new people; existing entries are not affected. You are notified by email when your balance is low and when it runs out.</>,
      <>Self-service accounts can create up to 20 queues; contact us if you need more.</>,
    ] },
    { h: "Payment, invoices and refunds", ul: [
      <>Payments are processed by Lemon Squeezy, which acts as merchant of record: it makes the sale, issues the invoice and collects applicable taxes. Lemon Squeezy's buyer terms also apply at checkout.</>,
      <>Price changes don't affect tickets already purchased.</>,
      <><b>Refunds:</b> a completely unused pack can be refunded within 14 days of purchase by writing to <Mail />. Partly used packs and free tickets are not refundable; refunded tickets are removed from your balance.</>,
      <>The statutory rights of consumers remain unaffected.</>,
    ] },
    { h: "Account Holder obligations", ul: [
      <>You use the service lawfully. Queue names and addresses must not be misleading, impersonate another person, organisation or brand, or contain insults, spam or unlawful content.</>,
      <>You are the controller of the data of visitors joining your queues and are responsible for informing them where required (e.g. a notice at the queue). Sıran Geldi processes that data only on your behalf to run the service.</>,
      <>Share attendant links only with authorised people; if a link leaks, renew it in the admin panel.</>,
      <>Sending automated requests that affect the security of the service or other users, circumventing the system or reverse engineering it is prohibited.</>,
    ] },
    { h: "Unsuitable use", p: [<>Sıran Geldi is a queue management tool. It must not be relied on alone for decisions directly affecting safety of life, such as emergency medical triage; problems with internet, phones or location services can affect how a queue works.</>] },
    { h: "Suspension and termination", ul: [
      <>If these terms are breached, in case of abuse or legal necessity, we may suspend or close your account with prior notice, or immediately in urgent cases. A suspended account's queues leave the map and stop accepting people.</>,
      <>You can delete your account at any time in the admin panel after deleting your queues. Remaining tickets of a deleted account are not refunded (the 14-day refund right is unaffected).</>,
    ] },
    { h: "Service level and liability", ul: [
      <>We make reasonable efforts to provide the service without interruption or errors, but maintenance, failures of infrastructure providers or causes beyond our control may lead to outages. The service is provided "as is".</>,
      <>To the extent permitted by law we are not liable for indirect damages, lost profits or disputes between you and your visitors. Towards Account Holders who are not consumers, our total liability is limited to the amount paid to us in the last 12 months.</>,
      <>Liability for intent and gross negligence and the statutory rights of consumers remain unaffected.</>,
    ] },
    { h: "Intellectual property", p: [<>The Sıran Geldi software, name and logo belong to us. Content you enter (queue names etc.) belongs to you; you grant us the right to display it so we can provide the service.</>] },
    { h: "Changes", p: [<>We may update these terms. We announce significant changes by email at least 15 days before they take effect; continuing to use the service afterwards means you accept the new terms.</>] },
    { h: "Governing law", p: [<>These terms are governed by the laws of the Republic of Türkiye, and the courts and enforcement offices of the Republic of Türkiye have jurisdiction. Consumers' rights to apply to consumer arbitration committees and consumer courts, and mandatory consumer protection rules of their country of residence, remain unaffected.</>] },
    { h: "Contact", p: [<>Questions: <Mail /></>] },
  ],
  de: [
    { h: "Parteien und Geltungsbereich", p: [<>Diese Bedingungen regeln das Verhältnis zwischen Sıran Geldi (sirangeldi.com) und den Personen oder Organisationen, die für den Warteschlangendienst ein Konto eröffnen („Kontoinhaber“). Mit der Registrierung akzeptieren Sie diese Bedingungen und die <Privacy>Datenschutzerklärung</Privacy>. Besucher einer Warteschlange eröffnen kein Konto; für sie gilt nur die Datenschutzerklärung.</>] },
    { h: "Konto", ul: [
      <>Sie müssen über 18 Jahre alt sein und, wenn Sie für eine Organisation handeln, zu deren Vertretung berechtigt sein.</>,
      <>Ihre Angaben müssen zutreffen; Warteschlangen können Sie erst nach Bestätigung Ihrer E-Mail anlegen.</>,
      <>Sie sind für die Sicherheit Ihres Passworts verantwortlich. Bemerken Sie eine unbefugte Nutzung, ändern Sie Ihr Passwort und informieren Sie uns.</>,
      <>Mehrere Konten zu eröffnen, um die kostenlosen Tickets mehrfach zu erhalten, ist untersagt.</>,
    ] },
    { h: "Dienst und Tickets", ul: [
      <><b>Ticket:</b> jeder neue Eintrag in Ihre Warteschlangen (per QR-Code oder durch das Personal) verbraucht 1 Ticket. Eine Gruppe ist ein Ticket; ein erneuter Eintritt vom selben Telefon verbraucht kein neues.</>,
      <><b>Kostenlose Tickets:</b> jedes neue Konto erhält einmalig 1.000 kostenlose Tickets.</>,
      <><b>Pakete:</b> sind die kostenlosen Tickets aufgebraucht, können Sie im Verwaltungsbereich Ticketpakete kaufen; dort werden aktuelle Pakete und Preise angezeigt.</>,
      <><b>Gültigkeit:</b> gekaufte Tickets verfallen nicht; sie sind nutzbar, solange der Dienst besteht und Ihr Konto offen ist.</>,
      <><b>Bei leerem Guthaben:</b> Ihre Warteschlangen nehmen niemanden mehr auf; bestehende Einträge bleiben unberührt. Bei niedrigem und aufgebrauchtem Guthaben werden Sie per E-Mail informiert.</>,
      <>Selbst eröffnete Konten können bis zu 20 Warteschlangen anlegen; für mehr kontaktieren Sie uns.</>,
    ] },
    { h: "Zahlung, Rechnung und Erstattung", ul: [
      <>Zahlungen werden über Lemon Squeezy abgewickelt. Lemon Squeezy ist Verkäufer (Merchant of Record): es führt den Verkauf durch, stellt die Rechnung aus und erhebt die anfallenden Steuern. Beim Kauf gelten zusätzlich die Käuferbedingungen von Lemon Squeezy.</>,
      <>Preisänderungen betreffen bereits gekaufte Tickets nicht.</>,
      <><b>Erstattung:</b> ein vollständig ungenutztes Paket kann innerhalb von 14 Tagen nach dem Kauf per E-Mail an <Mail /> erstattet werden. Teilweise genutzte Pakete und kostenlose Tickets sind nicht erstattungsfähig; erstattete Tickets werden vom Guthaben abgezogen.</>,
      <>Gesetzliche Verbraucherrechte bleiben unberührt.</>,
    ] },
    { h: "Pflichten der Kontoinhaber", ul: [
      <>Sie nutzen den Dienst rechtmäßig. Namen und Adressen von Warteschlangen dürfen nicht irreführend sein, keine andere Person, Organisation oder Marke nachahmen und keine Beleidigungen, Spam oder rechtswidrigen Inhalte enthalten.</>,
      <>Sie sind für die Daten der Besucher Ihrer Warteschlangen verantwortlich und müssen diese, wo erforderlich, informieren (z. B. durch einen Hinweis vor Ort). Sıran Geldi verarbeitet diese Daten nur in Ihrem Auftrag zum Betrieb des Dienstes.</>,
      <>Teilen Sie Personallinks nur mit befugten Personen; gelangt ein Link an Unbefugte, erneuern Sie ihn im Verwaltungsbereich.</>,
      <>Automatisierte Anfragen, die die Sicherheit des Dienstes oder andere Nutzer beeinträchtigen, das Umgehen des Systems und Reverse Engineering sind untersagt.</>,
    ] },
    { h: "Ungeeignete Nutzung", p: [<>Sıran Geldi ist ein Werkzeug zur Organisation von Warteschlangen. Für Entscheidungen, die unmittelbar die Sicherheit von Leben betreffen, etwa die Ersteinschätzung in der Notfallmedizin (Triage), darf es nicht allein verwendet werden; Störungen von Internet, Telefon oder Standortdiensten können den Ablauf beeinträchtigen.</>] },
    { h: "Sperrung und Kündigung", ul: [
      <>Bei Verstößen gegen diese Bedingungen, Missbrauch oder rechtlicher Notwendigkeit können wir Ihr Konto nach vorheriger Mitteilung, in dringenden Fällen sofort, sperren oder schließen. Die Warteschlangen eines gesperrten Kontos verschwinden von der Karte und nehmen niemanden auf.</>,
      <>Sie können Ihr Konto jederzeit im Verwaltungsbereich löschen, nachdem Sie Ihre Warteschlangen gelöscht haben. Restliche Tickets eines gelöschten Kontos werden nicht erstattet (das 14-tägige Erstattungsrecht bleibt unberührt).</>,
    ] },
    { h: "Dienstqualität und Haftung", ul: [
      <>Wir bemühen uns in angemessenem Umfang um einen unterbrechungs- und fehlerfreien Dienst; Wartung, Ausfälle von Infrastrukturanbietern oder Ursachen außerhalb unserer Kontrolle können jedoch zu Unterbrechungen führen. Der Dienst wird „wie besehen“ bereitgestellt.</>,
      <>Soweit gesetzlich zulässig, haften wir nicht für indirekte Schäden, entgangenen Gewinn oder Streitigkeiten zwischen Ihnen und Ihren Besuchern. Gegenüber Kontoinhabern, die keine Verbraucher sind, ist unsere Gesamthaftung auf den in den letzten 12 Monaten an uns gezahlten Betrag begrenzt.</>,
      <>Die Haftung für Vorsatz und grobe Fahrlässigkeit sowie gesetzliche Verbraucherrechte bleiben unberührt.</>,
    ] },
    { h: "Geistiges Eigentum", p: [<>Die Software, der Name und das Logo von Sıran Geldi gehören uns. Von Ihnen eingegebene Inhalte (Namen von Warteschlangen usw.) gehören Ihnen; Sie räumen uns das Recht ein, sie zur Erbringung des Dienstes anzuzeigen.</>] },
    { h: "Änderungen", p: [<>Wir können diese Bedingungen aktualisieren. Wesentliche Änderungen kündigen wir mindestens 15 Tage vor Inkrafttreten per E-Mail an; wenn Sie den Dienst danach weiter nutzen, gelten die neuen Bedingungen als akzeptiert.</>] },
    { h: "Anwendbares Recht", p: [<>Es gilt das Recht der Republik Türkei; zuständig sind die Gerichte und Vollstreckungsbehörden der Republik Türkei. Das Recht von Verbrauchern, sich an Verbraucherschiedsstellen und Verbrauchergerichte zu wenden, sowie zwingende Verbraucherschutzvorschriften ihres Wohnsitzlandes bleiben unberührt.</>] },
    { h: "Kontakt", p: [<>Fragen: <Mail /></>] },
  ],
  ru: [
    { h: "Стороны и сфера действия", p: [<>Эти условия регулируют отношения между Sıran Geldi (sirangeldi.com) и лицами или организациями, открывшими учётную запись в сервисе очередей («Владельцы учётных записей»). Регистрируясь, вы принимаете эти условия и <Privacy>Политику конфиденциальности</Privacy>. Посетители очередей учётную запись не открывают; для них действует только политика конфиденциальности.</>] },
    { h: "Учётная запись", ul: [
      <>Вам должно быть больше 18 лет; при регистрации от имени организации вы должны быть уполномочены её представлять.</>,
      <>Указанные сведения должны быть достоверными; создавать очереди можно только после подтверждения почты.</>,
      <>Вы отвечаете за сохранность пароля. Заметив несанкционированный доступ, смените пароль и сообщите нам.</>,
      <>Запрещено создавать несколько учётных записей, чтобы получить бесплатные билеты повторно.</>,
    ] },
    { h: "Сервис и билеты", ul: [
      <><b>Билет:</b> каждая новая запись в ваши очереди (по QR-коду или добавленная сотрудником) расходует 1 билет. Группа — это один билет; повторная запись с того же телефона новый билет не расходует.</>,
      <><b>Бесплатные билеты:</b> каждая новая учётная запись один раз получает 1000 бесплатных билетов.</>,
      <><b>Пакеты:</b> когда бесплатные билеты закончатся, пакеты можно купить в панели управления; там указаны актуальные пакеты и цены.</>,
      <><b>Срок действия:</b> купленные билеты не сгорают и действуют, пока работает сервис и открыта ваша учётная запись.</>,
      <><b>Когда баланс исчерпан:</b> очереди перестают принимать новых людей, существующие записи не затрагиваются. О низком и нулевом балансе вы получите письмо.</>,
      <>В самостоятельно открытой учётной записи можно создать до 20 очередей; если нужно больше, напишите нам.</>,
    ] },
    { h: "Оплата, счета и возврат", ul: [
      <>Платежи принимает Lemon Squeezy, выступающий продавцом (merchant of record): он совершает продажу, выставляет счёт и взимает применимые налоги. При покупке также действуют условия Lemon Squeezy для покупателей.</>,
      <>Изменение цен не влияет на уже купленные билеты.</>,
      <><b>Возврат:</b> полностью неиспользованный пакет можно вернуть в течение 14 дней с даты покупки, написав на <Mail />. Частично использованные пакеты и бесплатные билеты не возвращаются; билеты возвращённого пакета списываются с баланса.</>,
      <>Законные права потребителей сохраняются.</>,
    ] },
    { h: "Обязанности владельца учётной записи", ul: [
      <>Вы используете сервис законно. Названия и адреса очередей не должны вводить в заблуждение, выдавать себя за другое лицо, организацию или бренд, содержать оскорбления, спам или незаконный контент.</>,
      <>Вы являетесь оператором данных посетителей своих очередей и при необходимости должны их информировать (например, объявлением у очереди). Sıran Geldi обрабатывает эти данные только от вашего имени для работы сервиса.</>,
      <>Передавайте ссылки для сотрудников только уполномоченным лицам; если ссылка утекла, обновите её в панели управления.</>,
      <>Запрещены автоматические запросы, влияющие на безопасность сервиса или других пользователей, обход защиты и обратная разработка.</>,
    ] },
    { h: "Недопустимое использование", p: [<>Sıran Geldi — инструмент организации очередей. Его нельзя использовать как единственное средство для решений, прямо влияющих на безопасность жизни, например сортировки пациентов в экстренной медицине; сбои интернета, телефона или геолокации могут повлиять на работу очереди.</>] },
    { h: "Приостановка и прекращение", ul: [
      <>При нарушении этих условий, злоупотреблении или по требованию закона мы можем приостановить или закрыть учётную запись с предварительным уведомлением, а в срочных случаях — немедленно. Очереди приостановленной учётной записи исчезают с карты и не принимают людей.</>,
      <>Вы можете в любой момент удалить учётную запись в панели управления, предварительно удалив очереди. Оставшиеся билеты удалённой учётной записи не возвращаются (право на возврат в течение 14 дней сохраняется).</>,
    ] },
    { h: "Качество сервиса и ответственность", ul: [
      <>Мы прилагаем разумные усилия для бесперебойной и безошибочной работы, но обслуживание, сбои у поставщиков инфраструктуры или причины вне нашего контроля могут приводить к перерывам. Сервис предоставляется «как есть».</>,
      <>В пределах, допустимых законом, мы не отвечаем за косвенный ущерб, упущенную выгоду и споры между вами и вашими посетителями. Перед владельцами, не являющимися потребителями, наша совокупная ответственность ограничена суммой, уплаченной нам за последние 12 месяцев.</>,
      <>Ответственность за умысел и грубую неосторожность, а также законные права потребителей сохраняются.</>,
    ] },
    { h: "Интеллектуальная собственность", p: [<>Программное обеспечение, название и логотип Sıran Geldi принадлежат нам. Введённый вами контент (названия очередей и т. п.) принадлежит вам; вы предоставляете нам право показывать его для оказания услуги.</>] },
    { h: "Изменения", p: [<>Мы можем обновлять эти условия. О существенных изменениях сообщаем по почте не менее чем за 15 дней до вступления в силу; продолжая пользоваться сервисом, вы принимаете новые условия.</>] },
    { h: "Применимое право", p: [<>К этим условиям применяется право Турецкой Республики; споры рассматривают суды и органы исполнительного производства Турецкой Республики. Право потребителей обращаться в комиссии по защите прав потребителей и потребительские суды, а также обязательные нормы защиты потребителей страны их проживания сохраняются.</>] },
    { h: "Контакты", p: [<>Вопросы: <Mail /></>] },
  ],
});

mount(<LegalPage title={LEGAL.terms} sections={S} />);
