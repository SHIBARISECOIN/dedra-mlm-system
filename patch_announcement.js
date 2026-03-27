import admin from 'firebase-admin';

const serviceAccount = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const title_en = "📣 [Super Powerful Event Notice] A falling market actually becomes an opportunity!";
const content_en = `
<h1 data-section-id="c35l23" data-start="115" data-end="134">📣 [Super Powerful Event Notice]</h1>
<h1 data-section-id="5v8g73" data-start="135" data-end="155">A bear market is actually an opportunity!</h1>
<div bis_skin_checked="1"><br></div>
<h1 data-section-id="1a6474s" data-start="156" data-end="209"><span role="text"><strong data-start="158" data-end="209">DEEDRA ‘Bear Market Cushion’ Officially Opens</strong></span></h1>

<p data-start="211" data-end="234">Hello.<br data-start="217" data-end="220">
This is <strong data-start="220" data-end="230">DEEDRA</strong>.</p>
<p data-start="236" data-end="315">Anyone can smile when the market goes up.<br data-start="263" data-end="266">
But when the market shakes,<br data-start="280" data-end="283">
there are not many places that give <strong data-start="288" data-end="299">practical benefits</strong> to members.</p>
<p data-start="317" data-end="336">That's why DEEDRA prepared this.</p>

<h2 data-section-id="2836w2" data-start="338" data-end="363"><span role="text"><strong data-start="341" data-end="363">When a bear market comes, rewards follow.</strong></span></h2>
<h2 data-section-id="19fglq2" data-start="364" data-end="417"><span role="text"><strong data-start="367" data-end="417">DEEDRA Bear Market Cushion Officially Opens!</strong></span></h2>

<p data-start="419" data-end="510">From now on, a bear market is not just a time of anxiety and fear.<br data-start="451" data-end="454">
<strong data-start="454" data-end="499">For members who meet the conditions, a special event with additional benefits during the downward trend</strong> will be held together.</p>
<p data-start="512" data-end="570">In other words, the more the market goes down,<br data-start="524" data-end="527">
the more <strong data-start="543" data-end="558">opportunities to pay attention to</strong> can open up within DEEDRA.</p>
<hr data-start="572" data-end="575">

<h2 data-section-id="s6qw5a" data-start="577" data-end="611">📉 The more the market shakes, the stronger DEEDRA goes</h2>
<p data-start="613" data-end="702">Many platforms only talk about bull markets.<br data-start="634" data-end="637">
Everyone is flashy when it goes up.<br data-start="652" data-end="655">
But the real difference is revealed in <br data-start="666" data-end="669">
<strong data-start="669" data-end="693">how they treat members when the market falls</strong>.</p>
<p data-start="704" data-end="717">DEEDRA is different.</p>
<p data-start="719" data-end="791">When a bear market begins,<br data-start="728" data-end="731">
we don't just watch the flow,<br data-start="756" data-end="759">
we connect it to <strong data-start="759" data-end="782">practical benefits that members can experience</strong>.</p>
<p data-start="793" data-end="861">A bear market can be scary.<br data-start="811" data-end="814">
But in DEEDRA,<br data-start="827" data-end="830">
that drop can turn into an <strong data-start="836" data-end="849">opportunity for additional rewards</strong>.</p>
<hr data-start="863" data-end="866">

<h2 data-section-id="r10m7t" data-start="868" data-end="891">💥 The core of this event is simple</h2>
<p data-start="893" data-end="947"><strong data-start="893" data-end="910">During a bear market period</strong><br data-start="910" data-end="913">
Members who meet the conditions<br data-start="927" data-end="930">
<strong data-start="930" data-end="947">will receive additional benefits.</strong></p>
<p data-start="949" data-end="964">No complicated explanations are needed.</p>
<p data-start="966" data-end="1035">In the market downturn section,<br data-start="976" data-end="979">
DEEDRA applied this event strongly so that<br data-start="1012" data-end="1015">
members can experience a more favorable flow.</p>
<p data-start="1037" data-end="1052">To summarize in one word, it's this.</p>

<h2 data-section-id="zbs8wu" data-start="1054" data-end="1080">**“It is not disadvantageous because it is a bear market,</h2>
<p data-start="1081" data-end="1113">In DEEDRA, benefits arise precisely because it is a bear market.”**</p>
<hr data-start="1115" data-end="1118">

<h2 data-section-id="11cw5g5" data-start="1120" data-end="1134">🚨 Important Notice</h2>
<h2 data-section-id="1gjkr2h" data-start="1135" data-end="1177">Members who withdraw during a bear market period will be excluded from the event</h2>

<p data-start="1179" data-end="1229">This event is <br data-start="1186" data-end="1189">
<strong data-start="1189" data-end="1223">only for members who have no withdrawal history during the bear market period</strong>.</p>
<p data-start="1231" data-end="1233">That is,</p>
<ul data-start="1235" data-end="1305">
<li data-section-id="1lbyops" data-start="1235" data-end="1248">
During the bear market period
</li>
<li data-section-id="y7dn91" data-start="1249" data-end="1274">
<strong data-start="1251" data-end="1274">Any member who has proceeded with a withdrawal even once</strong>
</li>
<li data-section-id="3a31vp" data-start="1275" data-end="1305">
<strong data-start="1277" data-end="1305">Will be excluded from this bear market reward event</strong>
</li>
</ul>
<p data-start="1307" data-end="1329">Please be sure to check this part.</p>
<p data-start="1331" data-end="1426">This event is not simply a flow of coming in briefly and leaving,<br data-start="1338" data-end="1341">
<strong data-start="1369" data-end="1422">but a special reward policy to provide more meaningful benefits to members who endure and go together with the market</strong>.</p>
<p data-start="1428" data-end="1483">Therefore,<br data-start="1432" data-end="1435">
if there is a withdrawal history during the bear market period,<br data-start="1458" data-end="1461">
participation in the event and application of benefits will be restricted.</p>
<hr data-start="1485" data-end="1488">

<h2 data-section-id="bklxmv" data-start="1490" data-end="1518">🛡️ Stronger benefits for members who stay until the end</h2>
<p data-start="1520" data-end="1561">DEEDRA is not trying to hold an event just to gather a lot of people.</p>
<p data-start="1563" data-end="1673">What we want to create is a structure that<br data-start="1575" data-end="1578">
provides more certain rewards to <br data-start="1596" data-end="1599">
members who truly go together with the platform,<br data-start="1620" data-end="1623">
members who understand the flow and share the direction,<br data-start="1649" data-end="1652">
and members who see bigger opportunities than short-term fluctuations.</p>
<p data-start="1675" data-end="1701">This bear market reward event is exactly the symbol of that.</p>
<p data-start="1703" data-end="1781">Rather than a flow that comes and goes briefly,<br data-start="1719" data-end="1722">
<strong data-start="1722" data-end="1752">making the choice to go together until the end have a greater meaning.</strong><br data-start="1752" data-end="1755">
DEEDRA made that part clear.</p>
<hr data-start="1783" data-end="1786">

<h2 data-section-id="rfizhs" data-start="1788" data-end="1812">⚡ This is an especially powerful opportunity for these people</h2>
<ul data-start="1814" data-end="1952">
<li data-section-id="147x1of" data-start="1814" data-end="1838">
Those who want to see a bear market as an opportunity rather than being afraid of it
</li>
<li data-section-id="1fmm5sm" data-start="1839" data-end="1866">
Those who want to move one step ahead even in a shaking market
</li>
<li data-section-id="1t410yc" data-start="1867" data-end="1896">
Those who value structural rewards more than short-term fear
</li>
<li data-section-id="1va9lc5" data-start="1897" data-end="1920">
Those who want to bring the platform and the flow together
</li>
<li data-section-id="1l6pj41" data-start="1921" data-end="1952">
Those who want to maximize benefits by sharing the same direction without withdrawing
</li>
</ul>
<p data-start="1954" data-end="2020">This event is not just a notice to look at,<br data-start="1961" data-end="1964">
<strong data-start="1983" data-end="2016">but an aggressive reward event prepared to be actually felt</strong>.</p>
<hr data-start="2022" data-end="2025">

<h2 data-section-id="b5fine" data-start="2027" data-end="2055">🔥 The message DEEDRA conveys is clear</h2>
<p data-start="2057" data-end="2086">Just because the market falls<br data-start="2065" data-end="2068">
does not mean opportunities disappear as well.</p>
<p data-start="2088" data-end="2131">Rather,<br data-start="2091" data-end="2094">
someone retreats when it shakes,<br data-start="2110" data-end="2113">
someone moves forward at that time.</p>
<p data-start="2133" data-end="2185">And DEEDRA<br data-start="2144" data-end="2147">
<strong data-start="2165" data-end="2181">responds with practical benefits</strong><br data-start="2162" data-end="2165">
to members who move forward.</p>
<hr data-start="2187" data-end="2190">

<h2 data-section-id="2b015k" data-start="2192" data-end="2206">📌 Please be sure to remember</h2>
<ul data-start="2208" data-end="2359">
<li data-section-id="ei2vuk" data-start="2208" data-end="2247">
<strong data-start="2210" data-end="2247">The bear market reward event is applied according to conditions during the progress period</strong>
</li>
<li data-section-id="18v47np" data-start="2248" data-end="2286">
<strong data-start="2250" data-end="2286">Members who withdraw during the bear market period are excluded from the event</strong>
</li>
<li data-section-id="13tfoj1" data-start="2287" data-end="2322">
<strong data-start="2289" data-end="2322">Whether you are eligible for benefits is automatically reflected according to system standards</strong>
</li>
<li data-section-id="1ckqr6g" data-start="2323" data-end="2359">
<strong data-start="2325" data-end="2359">A separate notice may be exposed to members eligible for the event</strong>
</li>
</ul>
<hr data-start="2361" data-end="2364">

<h2 data-section-id="eulpjc" data-start="2366" data-end="2375">🚀 Conclusion</h2>
<p data-start="2377" data-end="2420">Everyone talks a lot in a bull market.<br data-start="2396" data-end="2399">
But the real thing is revealed in a bear market.</p>
<p data-start="2422" data-end="2454">And DEEDRA<br data-start="2433" data-end="2436">
shows that reality through actions.</p>

<h2 data-section-id="1gg4j6a" data-start="2456" data-end="2493"><span role="text"><strong data-start="2459" data-end="2493">Even when a bear market comes, DEEDRA's benefits do not stop.</strong></span></h2>
<h2 data-section-id="1hrlxjv" data-start="2494" data-end="2525"><span role="text"><strong data-start="2497" data-end="2525">The more the market shakes, the clearer the opportunity becomes.</strong></span></h2>

<p data-start="2527" data-end="2612">Now at DEEDRA<br data-start="2538" data-end="2541">
We hope you will personally confirm a flow different from others<br data-start="2582" data-end="2585">
together with the <strong data-start="2541" data-end="2577">Bear Market Cushion event</strong>.</p>
<p data-start="2614" data-end="2620">Thank you.</p><p data-start="2614" data-end="2620"><br></p>
<p data-start="2622" data-end="2639"><strong data-start="2622" data-end="2639">From the DEEDRA Operations Team</strong></p>
`;

const title_vi = "📣 [Thông báo Sự kiện Siêu Mạnh Mẽ] Thị trường giảm thực sự lại là một cơ hội!";
const content_vi = `
<h1 data-section-id="c35l23" data-start="115" data-end="134">📣 [Thông báo Sự kiện Siêu Mạnh Mẽ]</h1>
<h1 data-section-id="5v8g73" data-start="135" data-end="155">Thị trường giảm thực sự lại là một cơ hội!</h1>
<div bis_skin_checked="1"><br></div>
<h1 data-section-id="1a6474s" data-start="156" data-end="209"><span role="text"><strong data-start="158" data-end="209">Sự kiện DEEDRA ‘Bear Market Cushion’ Chính thức Mở cửa</strong></span></h1>

<p data-start="211" data-end="234">Xin chào.<br data-start="217" data-end="220">
Đây là <strong data-start="220" data-end="230">DEEDRA</strong>.</p>
<p data-start="236" data-end="315">Bất kỳ ai cũng có thể mỉm cười khi thị trường đi lên.<br data-start="263" data-end="266">
Nhưng khi thị trường rung lắc,<br data-start="280" data-end="283">
không có nhiều nơi mang lại <strong data-start="288" data-end="299">lợi ích thiết thực</strong> cho các thành viên.</p>
<p data-start="317" data-end="336">Đó là lý do tại sao DEEDRA chuẩn bị sự kiện này.</p>

<h2 data-section-id="2836w2" data-start="338" data-end="363"><span role="text"><strong data-start="341" data-end="363">Khi thị trường giảm giá đến, phần thưởng sẽ theo sau.</strong></span></h2>
<h2 data-section-id="19fglq2" data-start="364" data-end="417"><span role="text"><strong data-start="367" data-end="417">Sự kiện DEEDRA Bear Market Cushion Chính thức Mở cửa!</strong></span></h2>

<p data-start="419" data-end="510">Từ giờ trở đi, thị trường giảm giá không chỉ là khoảng thời gian lo âu và sợ hãi.<br data-start="451" data-end="454">
<strong data-start="454" data-end="499">Đối với những thành viên đáp ứng điều kiện, một sự kiện đặc biệt với các lợi ích bổ sung trong xu hướng giảm</strong> sẽ được tổ chức cùng nhau.</p>
<p data-start="512" data-end="570">Nói cách khác, thị trường càng giảm,<br data-start="524" data-end="527">
càng có nhiều <strong data-start="543" data-end="558">cơ hội đáng chú ý</strong> có thể mở ra trong DEEDRA.</p>
<hr data-start="572" data-end="575">

<h2 data-section-id="s6qw5a" data-start="577" data-end="611">📉 Thị trường càng rung lắc, DEEDRA càng mạnh mẽ hơn</h2>
<p data-start="613" data-end="702">Nhiều nền tảng chỉ nói về thị trường tăng giá.<br data-start="634" data-end="637">
Mọi thứ đều hào nhoáng khi thị trường đi lên.<br data-start="652" data-end="655">
Nhưng sự khác biệt thực sự được bộc lộ qua <br data-start="666" data-end="669">
<strong data-start="669" data-end="693">cách họ đối xử với các thành viên khi thị trường giảm giá</strong>.</p>
<p data-start="704" data-end="717">DEEDRA thì khác.</p>
<p data-start="719" data-end="791">Khi thị trường giảm giá bắt đầu,<br data-start="728" data-end="731">
chúng tôi không chỉ quan sát diễn biến,<br data-start="756" data-end="759">
chúng tôi kết nối nó với <strong data-start="759" data-end="782">những lợi ích thiết thực mà các thành viên có thể trải nghiệm</strong>.</p>
<p data-start="793" data-end="861">Thị trường giảm giá có thể đáng sợ.<br data-start="811" data-end="814">
Nhưng ở DEEDRA,<br data-start="827" data-end="830">
sự sụt giảm đó có thể biến thành một <strong data-start="836" data-end="849">cơ hội để nhận thêm phần thưởng</strong>.</p>
<hr data-start="863" data-end="866">

<h2 data-section-id="r10m7t" data-start="868" data-end="891">💥 Cốt lõi của sự kiện này rất đơn giản</h2>
<p data-start="893" data-end="947"><strong data-start="893" data-end="910">Trong giai đoạn thị trường giảm giá</strong><br data-start="910" data-end="913">
Các thành viên đáp ứng đủ điều kiện<br data-start="927" data-end="930">
<strong data-start="930" data-end="947">sẽ nhận được các lợi ích bổ sung.</strong></p>
<p data-start="949" data-end="964">Không cần những lời giải thích phức tạp.</p>
<p data-start="966" data-end="1035">Trong giai đoạn thị trường suy thoái,<br data-start="976" data-end="979">
DEEDRA đã áp dụng mạnh mẽ sự kiện này để<br data-start="1012" data-end="1015">
các thành viên có thể trải nghiệm một luồng di chuyển thuận lợi hơn.</p>
<p data-start="1037" data-end="1052">Tóm lại trong một câu, đó là thế này.</p>

<h2 data-section-id="zbs8wu" data-start="1054" data-end="1080">**“Không phải là bất lợi vì đây là thị trường giảm giá,</h2>
<p data-start="1081" data-end="1113">Ở DEEDRA, lợi ích phát sinh chính vì đây là thị trường giảm giá.”**</p>
<hr data-start="1115" data-end="1118">

<h2 data-section-id="11cw5g5" data-start="1120" data-end="1134">🚨 Thông báo Quan trọng</h2>
<h2 data-section-id="1gjkr2h" data-start="1135" data-end="1177">Các thành viên rút tiền trong giai đoạn thị trường giảm giá sẽ bị loại khỏi sự kiện</h2>

<p data-start="1179" data-end="1229">Sự kiện này <br data-start="1186" data-end="1189">
<strong data-start="1189" data-end="1223">chỉ dành cho các thành viên không có lịch sử rút tiền trong giai đoạn thị trường giảm giá</strong>.</p>
<p data-start="1231" data-end="1233">Nghĩa là,</p>
<ul data-start="1235" data-end="1305">
<li data-section-id="1lbyops" data-start="1235" data-end="1248">
Trong giai đoạn thị trường giảm giá
</li>
<li data-section-id="y7dn91" data-start="1249" data-end="1274">
<strong data-start="1251" data-end="1274">Bất kỳ thành viên nào tiến hành rút tiền dù chỉ một lần</strong>
</li>
<li data-section-id="3a31vp" data-start="1275" data-end="1305">
<strong data-start="1277" data-end="1305">Sẽ bị loại khỏi sự kiện phần thưởng thị trường giảm giá này</strong>
</li>
</ul>
<p data-start="1307" data-end="1329">Vui lòng đảm bảo kiểm tra kỹ phần này.</p>
<p data-start="1331" data-end="1426">Sự kiện này không chỉ đơn thuần là việc tham gia một thời gian ngắn rồi rời đi,<br data-start="1338" data-end="1341">
<strong data-start="1369" data-end="1422">mà là một chính sách khen thưởng đặc biệt nhằm cung cấp những lợi ích ý nghĩa hơn cho những thành viên kiên trì và đồng hành cùng thị trường</strong>.</p>
<p data-start="1428" data-end="1483">Do đó,<br data-start="1432" data-end="1435">
nếu có lịch sử rút tiền trong giai đoạn thị trường giảm giá,<br data-start="1458" data-end="1461">
việc tham gia sự kiện và áp dụng các lợi ích sẽ bị hạn chế.</p>
<hr data-start="1485" data-end="1488">

<h2 data-section-id="bklxmv" data-start="1490" data-end="1518">🛡️ Lợi ích mạnh mẽ hơn cho các thành viên đồng hành đến cùng</h2>
<p data-start="1520" data-end="1561">DEEDRA không cố gắng tổ chức một sự kiện chỉ để thu hút nhiều người tham gia.</p>
<p data-start="1563" data-end="1673">Điều chúng tôi muốn tạo ra là một cấu trúc<br data-start="1575" data-end="1578">
cung cấp những phần thưởng chắc chắn hơn cho <br data-start="1596" data-end="1599">
những thành viên thực sự đồng hành cùng nền tảng,<br data-start="1620" data-end="1623">
những thành viên hiểu rõ xu hướng và chia sẻ cùng chung định hướng,<br data-start="1649" data-end="1652">
và những thành viên nhìn thấy những cơ hội lớn hơn là những biến động ngắn hạn.</p>
<p data-start="1675" data-end="1701">Sự kiện phần thưởng thị trường giảm giá này chính là biểu tượng của điều đó.</p>
<p data-start="1703" data-end="1781">Thay vì một luồng di chuyển đến và đi trong thời gian ngắn,<br data-start="1719" data-end="1722">
<strong data-start="1722" data-end="1752">biến lựa chọn đồng hành đến cùng mang một ý nghĩa lớn lao hơn.</strong><br data-start="1752" data-end="1755">
DEEDRA đã làm rõ điều đó.</p>
<hr data-start="1783" data-end="1786">

<h2 data-section-id="rfizhs" data-start="1788" data-end="1812">⚡ Đây là một cơ hội đặc biệt mạnh mẽ đối với những người này</h2>
<ul data-start="1814" data-end="1952">
<li data-section-id="147x1of" data-start="1814" data-end="1838">
Những người muốn nhìn nhận thị trường giảm giá như một cơ hội thay vì e sợ nó
</li>
<li data-section-id="1fmm5sm" data-start="1839" data-end="1866">
Những người muốn tiến lên một bước ngay cả trong một thị trường đang rung lắc
</li>
<li data-section-id="1t410yc" data-start="1867" data-end="1896">
Những người đánh giá cao các phần thưởng mang tính cấu trúc hơn là nỗi sợ hãi ngắn hạn
</li>
<li data-section-id="1va9lc5" data-start="1897" data-end="1920">
Những người muốn gắn kết nền tảng và xu hướng lại với nhau
</li>
<li data-section-id="1l6pj41" data-start="1921" data-end="1952">
Những người muốn tối đa hóa lợi ích bằng cách chia sẻ cùng một hướng đi mà không rút tiền
</li>
</ul>
<p data-start="1954" data-end="2020">Sự kiện này không chỉ là một thông báo để đọc,<br data-start="1961" data-end="1964">
<strong data-start="1983" data-end="2016">mà là một sự kiện khen thưởng tích cực được chuẩn bị để thực sự có thể cảm nhận được</strong>.</p>
<hr data-start="2022" data-end="2025">

<h2 data-section-id="b5fine" data-start="2027" data-end="2055">🔥 Thông điệp mà DEEDRA truyền tải rất rõ ràng</h2>
<p data-start="2057" data-end="2086">Chỉ vì thị trường đi xuống<br data-start="2065" data-end="2068">
không có nghĩa là các cơ hội cũng biến mất.</p>
<p data-start="2088" data-end="2131">Thực ra,<br data-start="2091" data-end="2094">
có người chùn bước khi thị trường rung lắc,<br data-start="2110" data-end="2113">
cũng có người tiến về phía trước vào thời điểm đó.</p>
<p data-start="2133" data-end="2185">Và DEEDRA<br data-start="2144" data-end="2147">
<strong data-start="2165" data-end="2181">đáp lại bằng những lợi ích thiết thực</strong><br data-start="2162" data-end="2165">
dành cho những thành viên tiến về phía trước.</p>
<hr data-start="2187" data-end="2190">

<h2 data-section-id="2b015k" data-start="2192" data-end="2206">📌 Xin hãy ghi nhớ chắc chắn</h2>
<ul data-start="2208" data-end="2359">
<li data-section-id="ei2vuk" data-start="2208" data-end="2247">
<strong data-start="2210" data-end="2247">Sự kiện phần thưởng thị trường giảm giá được áp dụng theo các điều kiện trong thời gian diễn ra</strong>
</li>
<li data-section-id="18v47np" data-start="2248" data-end="2286">
<strong data-start="2250" data-end="2286">Các thành viên rút tiền trong thời gian thị trường giảm giá sẽ bị loại khỏi sự kiện</strong>
</li>
<li data-section-id="13tfoj1" data-start="2287" data-end="2322">
<strong data-start="2289" data-end="2322">Việc bạn có đủ điều kiện nhận lợi ích hay không sẽ tự động được phản ánh theo tiêu chuẩn của hệ thống</strong>
</li>
<li data-section-id="1ckqr6g" data-start="2323" data-end="2359">
<strong data-start="2325" data-end="2359">Một thông báo riêng có thể được hiển thị cho các thành viên đủ điều kiện tham gia sự kiện</strong>
</li>
</ul>
<hr data-start="2361" data-end="2364">

<h2 data-section-id="eulpjc" data-start="2366" data-end="2375">🚀 Kết luận</h2>
<p data-start="2377" data-end="2420">Mọi người thường nói rất nhiều trong một thị trường tăng giá.<br data-start="2396" data-end="2399">
Nhưng thực tế mới được bộc lộ trong một thị trường giảm giá.</p>
<p data-start="2422" data-end="2454">Và DEEDRA<br data-start="2433" data-end="2436">
cho thấy thực tế đó thông qua hành động.</p>

<h2 data-section-id="1gg4j6a" data-start="2456" data-end="2493"><span role="text"><strong data-start="2459" data-end="2493">Ngay cả khi thị trường giảm giá ập đến, lợi ích của DEEDRA cũng không dừng lại.</strong></span></h2>
<h2 data-section-id="1hrlxjv" data-start="2494" data-end="2525"><span role="text"><strong data-start="2497" data-end="2525">Thị trường càng rung lắc, cơ hội càng trở nên rõ ràng hơn.</strong></span></h2>

<p data-start="2527" data-end="2612">Bây giờ tại DEEDRA<br data-start="2538" data-end="2541">
Chúng tôi hy vọng bạn sẽ tự mình xác nhận một hướng đi khác biệt so với những người khác<br data-start="2582" data-end="2585">
cùng với <strong data-start="2541" data-end="2577">Sự kiện Bear Market Cushion</strong>.</p>
<p data-start="2614" data-end="2620">Xin cảm ơn.</p><p data-start="2614" data-end="2620"><br></p>
<p data-start="2622" data-end="2639"><strong data-start="2622" data-end="2639">Từ Đội ngũ Điều hành DEEDRA</strong></p>
`;

const title_th = "📣 [ประกาศกิจกรรมสุดทรงพลัง] ตลาดขาลงแท้จริงแล้วคือโอกาส!";
const content_th = `
<h1 data-section-id="c35l23" data-start="115" data-end="134">📣 [ประกาศกิจกรรมสุดทรงพลัง]</h1>
<h1 data-section-id="5v8g73" data-start="135" data-end="155">ตลาดขาลงแท้จริงแล้วคือโอกาส!</h1>
<div bis_skin_checked="1"><br></div>
<h1 data-section-id="1a6474s" data-start="156" data-end="209"><span role="text"><strong data-start="158" data-end="209">เปิดตัวอย่างเป็นทางการกับ DEEDRA ‘Bear Market Cushion’</strong></span></h1>

<p data-start="211" data-end="234">สวัสดีครับ<br data-start="217" data-end="220">
นี่คือ <strong data-start="220" data-end="230">DEEDRA</strong></p>
<p data-start="236" data-end="315">ใครๆ ก็ยิ้มได้เมื่อตลาดปรับตัวขึ้น<br data-start="263" data-end="266">
แต่เมื่อตลาดเกิดการสั่นคลอน<br data-start="280" data-end="283">
มีไม่กี่แห่งที่มอบ <strong data-start="288" data-end="299">ผลประโยชน์ที่เป็นรูปธรรม</strong> ให้กับสมาชิก</p>
<p data-start="317" data-end="336">นั่นคือเหตุผลที่ DEEDRA เตรียมสิ่งนี้ไว้</p>

<h2 data-section-id="2836w2" data-start="338" data-end="363"><span role="text"><strong data-start="341" data-end="363">เมื่อตลาดขาลงมาถึง รางวัลก็จะตามมา</strong></span></h2>
<h2 data-section-id="19fglq2" data-start="364" data-end="417"><span role="text"><strong data-start="367" data-end="417">กิจกรรม DEEDRA Bear Market Cushion เปิดตัวอย่างเป็นทางการแล้ว!</strong></span></h2>

<p data-start="419" data-end="510">จากนี้ไป ตลาดขาลงจะไม่ใช่แค่ช่วงเวลาแห่งความวิตกกังวลและความกลัวอีกต่อไป<br data-start="451" data-end="454">
<strong data-start="454" data-end="499">สำหรับสมาชิกที่ตรงตามเงื่อนไข กิจกรรมพิเศษพร้อมสิทธิประโยชน์เพิ่มเติมในช่วงแนวโน้มขาลง</strong> จะจัดขึ้นไปพร้อมๆ กัน</p>
<p data-start="512" data-end="570">กล่าวอีกนัยหนึ่ง ยิ่งตลาดปรับตัวลงมากเท่าไหร่<br data-start="524" data-end="527">
<strong data-start="543" data-end="558">โอกาสที่น่าจับตามอง</strong> ก็สามารถเปิดกว้างขึ้นภายใน DEEDRA</p>
<hr data-start="572" data-end="575">

<h2 data-section-id="s6qw5a" data-start="577" data-end="611">📉 ยิ่งตลาดสั่นคลอนมากเท่าไหร่ DEEDRA ก็ยิ่งแข็งแกร่งขึ้น</h2>
<p data-start="613" data-end="702">แพลตฟอร์มหลายแห่งพูดถึงแต่ตลาดขาขึ้นเท่านั้น<br data-start="634" data-end="637">
ทุกอย่างดูสวยหรูเมื่อมันขึ้น<br data-start="652" data-end="655">
แต่ความแตกต่างที่แท้จริงจะเผยให้เห็นตรงที่ <br data-start="666" data-end="669">
<strong data-start="669" data-end="693">พวกเขาปฏิบัติต่อสมาชิกอย่างไรเมื่อตลาดร่วงลง</strong></p>
<p data-start="704" data-end="717">DEEDRA นั้นแตกต่าง</p>
<p data-start="719" data-end="791">เมื่อตลาดขาลงเริ่มต้นขึ้น<br data-start="728" data-end="731">
เราไม่เพียงแค่เฝ้าดูสถานการณ์<br data-start="756" data-end="759">
เราเชื่อมโยงมันเข้ากับ <strong data-start="759" data-end="782">ผลประโยชน์ที่เป็นรูปธรรมที่สมาชิกสามารถสัมผัสได้จริง</strong></p>
<p data-start="793" data-end="861">ตลาดขาลงอาจน่ากลัว<br data-start="811" data-end="814">
แต่ที่ DEEDRA<br data-start="827" data-end="830">
การร่วงลงนั้นสามารถกลายเป็น <strong data-start="836" data-end="849">โอกาสสำหรับรางวัลเพิ่มเติมได้</strong></p>
<hr data-start="863" data-end="866">

<h2 data-section-id="r10m7t" data-start="868" data-end="891">💥 แก่นแท้ของกิจกรรมนี้เรียบง่ายมาก</h2>
<p data-start="893" data-end="947"><strong data-start="893" data-end="910">ในช่วงระยะเวลาของตลาดขาลง</strong><br data-start="910" data-end="913">
สมาชิกที่ตรงตามเงื่อนไข<br data-start="927" data-end="930">
<strong data-start="930" data-end="947">จะได้รับสิทธิประโยชน์เพิ่มเติม</strong></p>
<p data-start="949" data-end="964">ไม่จำเป็นต้องมีคำอธิบายที่ซับซ้อน</p>
<p data-start="966" data-end="1035">ในช่วงที่ตลาดตกต่ำ<br data-start="976" data-end="979">
DEEDRA ได้นำกิจกรรมนี้มาปรับใช้อย่างแข็งขันเพื่อให้<br data-start="1012" data-end="1015">
สมาชิกสามารถสัมผัสกับกระแสที่เอื้ออำนวยมากขึ้น</p>
<p data-start="1037" data-end="1052">สรุปในประโยคเดียวคือสิ่งนี้</p>

<h2 data-section-id="zbs8wu" data-start="1054" data-end="1080">**“มันไม่ได้เสียเปรียบเพราะเป็นตลาดขาลง</h2>
<p data-start="1081" data-end="1113">ที่ DEEDRA ผลประโยชน์จะเกิดขึ้นก็เพราะเป็นตลาดขาลงต่างหาก”**</p>
<hr data-start="1115" data-end="1118">

<h2 data-section-id="11cw5g5" data-start="1120" data-end="1134">🚨 ประกาศสำคัญ</h2>
<h2 data-section-id="1gjkr2h" data-start="1135" data-end="1177">สมาชิกที่ถอนเงินในช่วงตลาดขาลงจะถูกตัดสิทธิ์จากกิจกรรมนี้</h2>

<p data-start="1179" data-end="1229">กิจกรรมนี้ <br data-start="1186" data-end="1189">
<strong data-start="1189" data-end="1223">จัดขึ้นสำหรับสมาชิกที่ไม่มีประวัติการถอนเงินในช่วงตลาดขาลงเท่านั้น</strong></p>
<p data-start="1231" data-end="1233">นั่นคือ</p>
<ul data-start="1235" data-end="1305">
<li data-section-id="1lbyops" data-start="1235" data-end="1248">
ในช่วงระยะเวลาของตลาดขาลง
</li>
<li data-section-id="y7dn91" data-start="1249" data-end="1274">
<strong data-start="1251" data-end="1274">สมาชิกรายใดที่ดำเนินการถอนเงินแม้แต่ครั้งเดียว</strong>
</li>
<li data-section-id="3a31vp" data-start="1275" data-end="1305">
<strong data-start="1277" data-end="1305">จะถูกตัดสิทธิ์จากกิจกรรมรางวัลตลาดขาลงนี้</strong>
</li>
</ul>
<p data-start="1307" data-end="1329">โปรดตรวจสอบส่วนนี้ให้แน่ใจ</p>
<p data-start="1331" data-end="1426">กิจกรรมนี้ไม่ได้เป็นเพียงแค่กระแสของการเข้ามาช่วงสั้นๆ แล้วจากไป<br data-start="1338" data-end="1341">
<strong data-start="1369" data-end="1422">แต่เป็นนโยบายการให้รางวัลพิเศษเพื่อมอบผลประโยชน์ที่มีความหมายมากขึ้นแก่สมาชิกที่อดทนและก้าวไปพร้อมกับตลาด</strong></p>
<p data-start="1428" data-end="1483">ดังนั้น<br data-start="1432" data-end="1435">
หากมีประวัติการถอนเงินในช่วงตลาดขาลง<br data-start="1458" data-end="1461">
การเข้าร่วมกิจกรรมและการรับสิทธิประโยชน์จะถูกจำกัด</p>
<hr data-start="1485" data-end="1488">

<h2 data-section-id="bklxmv" data-start="1490" data-end="1518">🛡️ สิทธิประโยชน์ที่แข็งแกร่งกว่าสำหรับสมาชิกที่อยู่ด้วยกันจนถึงที่สุด</h2>
<p data-start="1520" data-end="1561">DEEDRA ไม่ได้พยายามจัดกิจกรรมเพียงเพื่อดึงดูดผู้คนจำนวนมาก</p>
<p data-start="1563" data-end="1673">สิ่งที่เราต้องการสร้างคือโครงสร้างที่<br data-start="1575" data-end="1578">
มอบรางวัลที่แน่นอนยิ่งขึ้นให้กับ <br data-start="1596" data-end="1599">
สมาชิกที่ก้าวไปพร้อมกับแพลตฟอร์มอย่างแท้จริง<br data-start="1620" data-end="1623">
สมาชิกที่เข้าใจกระแสและมีทิศทางร่วมกัน<br data-start="1649" data-end="1652">
และสมาชิกที่มองเห็นโอกาสที่ใหญ่กว่าความผันผวนในระยะสั้น</p>
<p data-start="1675" data-end="1701">กิจกรรมรางวัลตลาดขาลงนี้คือสัญลักษณ์ของสิ่งนั้น</p>
<p data-start="1703" data-end="1781">แทนที่จะเป็นกระแสที่ผ่านมาแล้วก็ผ่านไปอย่างรวดเร็ว<br data-start="1719" data-end="1722">
<strong data-start="1722" data-end="1752">การตัดสินใจที่จะก้าวไปด้วยกันจนถึงที่สุดย่อมมีความหมายที่ยิ่งใหญ่กว่า</strong><br data-start="1752" data-end="1755">
DEEDRA ทำให้ส่วนนั้นชัดเจนขึ้น</p>
<hr data-start="1783" data-end="1786">

<h2 data-section-id="rfizhs" data-start="1788" data-end="1812">⚡ นี่คือโอกาสที่ทรงพลังอย่างยิ่งสำหรับบุคคลเหล่านี้</h2>
<ul data-start="1814" data-end="1952">
<li data-section-id="147x1of" data-start="1814" data-end="1838">
ผู้ที่ต้องการมองตลาดขาลงเป็นโอกาส แทนที่จะกลัวมัน
</li>
<li data-section-id="1fmm5sm" data-start="1839" data-end="1866">
ผู้ที่ต้องการก้าวล้ำนำหน้าไปหนึ่งก้าว แม้ในตลาดที่กำลังสั่นคลอน
</li>
<li data-section-id="1t410yc" data-start="1867" data-end="1896">
ผู้ที่ให้ความสำคัญกับรางวัลเชิงโครงสร้างมากกว่าความกลัวระยะสั้น
</li>
<li data-section-id="1va9lc5" data-start="1897" data-end="1920">
ผู้ที่ต้องการนำแพลตฟอร์มและกระแสขับเคลื่อนไปพร้อมกัน
</li>
<li data-section-id="1l6pj41" data-start="1921" data-end="1952">
ผู้ที่ต้องการเพิ่มผลประโยชน์สูงสุดด้วยการแบ่งปันแนวทางเดียวกันโดยไม่ต้องถอนเงิน
</li>
</ul>
<p data-start="1954" data-end="2020">กิจกรรมนี้ไม่ใช่แค่ประกาศเพื่อให้ดูผ่านๆ<br data-start="1961" data-end="1964">
<strong data-start="1983" data-end="2016">แต่เป็นกิจกรรมการให้รางวัลเชิงรุกที่เตรียมไว้เพื่อให้สัมผัสได้อย่างแท้จริง</strong></p>
<hr data-start="2022" data-end="2025">

<h2 data-section-id="b5fine" data-start="2027" data-end="2055">🔥 ข้อความที่ DEEDRA สื่อสารนั้นชัดเจน</h2>
<p data-start="2057" data-end="2086">เพียงเพราะตลาดตกต่ำ<br data-start="2065" data-end="2068">
ไม่ได้หมายความว่าโอกาสจะหายไปด้วย</p>
<p data-start="2088" data-end="2131">ในทางกลับกัน<br data-start="2091" data-end="2094">
บางคนถอยหนีเมื่อมันสั่นคลอน<br data-start="2110" data-end="2113">
แต่บางคนกลับเดินหน้าต่อไปในเวลานั้น</p>
<p data-start="2133" data-end="2185">และ DEEDRA<br data-start="2144" data-end="2147">
<strong data-start="2165" data-end="2181">ตอบสนองด้วยผลประโยชน์ที่เป็นรูปธรรม</strong><br data-start="2162" data-end="2165">
ให้กับสมาชิกที่ก้าวไปข้างหน้า</p>
<hr data-start="2187" data-end="2190">

<h2 data-section-id="2b015k" data-start="2192" data-end="2206">📌 โปรดจำไว้ให้ดี</h2>
<ul data-start="2208" data-end="2359">
<li data-section-id="ei2vuk" data-start="2208" data-end="2247">
<strong data-start="2210" data-end="2247">กิจกรรมรางวัลตลาดขาลงจะถูกนำไปใช้ตามเงื่อนไขในช่วงระยะเวลาที่ดำเนินการ</strong>
</li>
<li data-section-id="18v47np" data-start="2248" data-end="2286">
<strong data-start="2250" data-end="2286">สมาชิกที่ถอนเงินในช่วงตลาดขาลงจะถูกตัดสิทธิ์จากกิจกรรม</strong>
</li>
<li data-section-id="13tfoj1" data-start="2287" data-end="2322">
<strong data-start="2289" data-end="2322">การที่คุณมีสิทธิ์ได้รับผลประโยชน์หรือไม่นั้น จะแสดงผลโดยอัตโนมัติตามมาตรฐานของระบบ</strong>
</li>
<li data-section-id="1ckqr6g" data-start="2323" data-end="2359">
<strong data-start="2325" data-end="2359">อาจมีการแสดงประกาศแยกต่างหากสำหรับสมาชิกที่มีสิทธิ์เข้าร่วมกิจกรรม</strong>
</li>
</ul>
<hr data-start="2361" data-end="2364">

<h2 data-section-id="eulpjc" data-start="2366" data-end="2375">🚀 บทสรุป</h2>
<p data-start="2377" data-end="2420">ทุกคนมักจะพูดกันเยอะในตลาดขาขึ้น<br data-start="2396" data-end="2399">
แต่ความเป็นจริงมักจะเผยออกมาในตลาดขาลง</p>
<p data-start="2422" data-end="2454">และ DEEDRA<br data-start="2433" data-end="2436">
แสดงให้เห็นถึงความเป็นจริงนั้นผ่านการกระทำ</p>

<h2 data-section-id="1gg4j6a" data-start="2456" data-end="2493"><span role="text"><strong data-start="2459" data-end="2493">แม้ในยามที่ตลาดขาลงมาเยือน ผลประโยชน์ของ DEEDRA ก็ไม่เคยหยุดนิ่ง</strong></span></h2>
<h2 data-section-id="1hrlxjv" data-start="2494" data-end="2525"><span role="text"><strong data-start="2497" data-end="2525">ยิ่งตลาดสั่นคลอนมากเท่าไหร่ โอกาสก็ยิ่งชัดเจนมากขึ้นเท่านั้น</strong></span></h2>

<p data-start="2527" data-end="2612">ตอนนี้ที่ DEEDRA<br data-start="2538" data-end="2541">
เราหวังว่าคุณจะยืนยันกระแสที่แตกต่างจากคนอื่นๆ ด้วยตัวคุณเอง<br data-start="2582" data-end="2585">
ไปพร้อมกับ <strong data-start="2541" data-end="2577">กิจกรรม Bear Market Cushion</strong></p>
<p data-start="2614" data-end="2620">ขอขอบคุณ</p><p data-start="2614" data-end="2620"><br></p>
<p data-start="2622" data-end="2639"><strong data-start="2622" data-end="2639">จากทีมปฏิบัติการ DEEDRA</strong></p>
`;

async function run() {
  const docRef = db.collection('announcements').doc('11KabUWLKQRpTwupATsF');
  await docRef.update({
    title_en: title_en,
    content_en: content_en,
    title_vi: title_vi,
    content_vi: content_vi,
    title_th: title_th,
    content_th: content_th
  });
  console.log('Successfully updated announcement 11KabUWLKQRpTwupATsF with high quality translations!');
}
run();
