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

async function run() {
  const snap = await db.collection('announcements').orderBy('createdAt', 'desc').limit(10).get();
  let targetDoc = null;
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.title && data.title.includes('라스트맨')) {
      targetDoc = doc;
    }
  });

  if (!targetDoc) {
    console.log('No matching announcement found.');
    process.exit(1);
  }

  console.log(`Found target document: ${targetDoc.id} - ${targetDoc.data().title}`);
  
  const title_en = "📣 [Notice] Mega Special Event: Last Man Jackpot Officially Open!";
  const content_en = `Hello.
This is DEEDRA.

The mega special event that will make your heart race, the **Last Man Jackpot**, has finally officially opened on the main screen.

The Last Man Jackpot is not just a simple game of luck.
It is DEEDRA's unique battle of wits where timing, judgment, and teamwork determine the winner.

Who takes the last spot, and who defends it until the very end, will determine the owner of the massive accumulated jackpot prize.

🎰 **What is the Last Man Jackpot?**
The following information is displayed in real-time at the top of the main screen:
- Current Accumulated Jackpot Prize
- 24-Hour Countdown Timer
- Current Last Investor (Potential Winner)

The moment this timer reaches 00:00:00, the **single last investor** recorded in the system will acquire the entire accumulated jackpot prize.

In other words, the one and only person who holds their ground until the end becomes the owner of all the prize money.

⏰ **How to Participate & Timer Reset Rules**
Participation in the Last Man Jackpot is automatic without any separate application.

You automatically participate in the event if you meet the following conditions:
- FREEZE Investment of 100 USDT or more
- Reinvestment of profits of 100 USDT or more

And as soon as someone completes an investment under these conditions:
**The previous last investor is pushed out, the new investor is registered as the new potential winner, and the countdown timer resets to 24 hours.**

In other words, even at the very last moment, if someone else completes an investment of 100 USDT or more, the tables are turned again.

👑 **The Moment You Become the Last Investor**
When you are registered as the last investor, a part of your ID is masked and displayed in real-time on the main screen banner.
*(Example: abc**)*

This means all members can immediately see who currently holds the throne.

But it doesn't end here. The truly important thing is not taking the spot, but holding on until the end.
If another member invests again before the timer ends, the last investor is immediately changed, and the timer is reset again.

🏆 **Winning Conditions**
The winning conditions are very simple.

After a member becomes the last investor, if no one makes an additional investment of 100 USDT or more for 24 hours and the timer reaches 00:00:00, the last investor at that moment becomes the final winner.

And that member acquires the **entire accumulated jackpot prize**.

🔥 **The True Core of This Event**
**Not a Solo Game — Teamplay Feature Added**

The biggest feature of this Last Man Jackpot is that it's not just an event for individuals.

If a partner in your downline becomes the last investor and wins the jackpot, the rewards don't stop with the winner.
A **‘Congratulatory Roll-up Bonus’** will be paid together to the upper sponsor line that produced the jackpot winner, applying a teamplay feature.

In other words:
**Even if you do not become the last investor yourself, if your team partner succeeds in the jackpot, the upper sponsor line can also receive rewards together.**

Now, the Last Man Jackpot is not just a game of "Do I get it or not," but a battle of "Does our team take the jackpot, or do we hand it over to another team?"

This is the real fun point. It looks like an individual match, but it's actually a team battle.

💰 **Team Roll-up Bonus Info**
When a jackpot winner emerges, a congratulatory roll-up bonus is automatically applied to the upper sponsor line that produced the winner, according to the system standards.
- **The Winner**: Acquires the Jackpot Prize
- **Upper Sponsor Line**: Congratulatory Roll-up Bonus Paid

The detailed distribution ratio will be automatically reflected according to the system standards, and the reward will be normally applied at the time the winning occurs.

In short, it's a structure where the whole team can smile together if a winner comes from your team.

💡 **Last Man Jackpot Strategy Points**
It's a shame to play this event just by feeling. It's much more fun when you know the points.

**1. Keep an eye on the timer until the end**
Who comes in last when there is little time left determines the winner. The last few minutes and seconds are the key.
**2. View it as a team battle, not an individual match**
Even if you can't catch it yourself, if your downline partner catches it, the reward connects to the upper line. In short, the more the team moves, the stronger you become.
**3. Don't hand the jackpot over to another team**
It's a waste to let another line take it when the timer is almost up. It's important to move together with the partners in your team while watching the timing.
**4. The final timing is everything**
No matter how early you enter, it's over if you can't protect the end. Conversely, entering at the decisive moment can turn the tables all at once.

📌 **Things You Must Know**
- Event participation and timer resets are only recognized for investments of 100 USDT or more.
- Becoming the last investor does not immediately confirm your win.
- If another member additionally invests 100 USDT or more before the timer ends, the last investor is immediately changed.
- At the same time, the countdown timer is also reset to 24 hours.
- Ultimately, the 1 last investor at the time the timer ends becomes the owner of the jackpot prize.
- Additionally, a team roll-up bonus is applied to the upper sponsor line that produced the winner.

🚀 **Closing Remarks**
The Last Man Jackpot is not a simple event.

Someone will seize the throne at the last moment,
someone will hold on to protect that throne,
and someone will aim for greater rewards together with their team partners.

Now, only one thing is important.

Who will be the last man?
And which team will take the glory of this massive jackpot?

Check the jackpot banner on the main screen right now, recapture the current potential winner spot, and bring the glory of the jackpot to you and your team.

Thank you.

From the DEEDRA Operations Team`;

  const title_vi = "📣 [Thông báo] Sự kiện đặc biệt siêu khủng: Last Man Jackpot chính thức ra mắt!";
  const content_vi = `Xin chào.
Đây là DEEDRA.

Sự kiện đặc biệt siêu khủng sẽ làm trái tim bạn đập rộn ràng, **Last Man Jackpot**, cuối cùng đã chính thức ra mắt trên màn hình chính.

Last Man Jackpot không chỉ là một trò chơi may rủi đơn thuần.
Đó là một cuộc đấu trí đặc biệt của riêng DEEDRA, nơi thời điểm, sự phán đoán và tinh thần đồng đội sẽ quyết định chiến thắng.

Ai chiếm được vị trí cuối cùng, và ai giữ được vị trí đó cho đến phút chót, sẽ quyết định chủ nhân của giải thưởng jackpot tích lũy khổng lồ.

🎰 **Last Man Jackpot là gì?**
Các thông tin sau sẽ được hiển thị theo thời gian thực ở phần trên cùng của màn hình chính:
- Tiền thưởng Jackpot tích lũy hiện tại
- Đồng hồ đếm ngược 24 giờ
- Nhà đầu tư cuối cùng hiện tại (Người có khả năng trúng thưởng)

Khoảnh khắc đồng hồ này điểm 00:00:00, **1 nhà đầu tư cuối cùng** được ghi nhận trong hệ thống sẽ giành được toàn bộ số tiền thưởng jackpot tích lũy.

Tức là, người duy nhất giữ vững vị trí đến cuối cùng sẽ trở thành chủ nhân của toàn bộ giải thưởng.

⏰ **Cách thức tham gia & Quy tắc làm mới đồng hồ**
Last Man Jackpot sẽ tự động cho phép tham gia mà không cần đăng ký riêng.

Bạn sẽ tự động tham gia sự kiện nếu đáp ứng các điều kiện sau:
- Đầu tư FREEZE từ 100 USDT trở lên
- Tái đầu tư lợi nhuận từ 100 USDT trở lên

Và ngay khi có người hoàn tất đầu tư với các điều kiện trên:
**Nhà đầu tư cuối cùng trước đó sẽ bị đẩy lùi, nhà đầu tư mới sẽ được đăng ký làm người trúng thưởng dự kiến mới và đồng hồ đếm ngược sẽ được đặt lại thành 24 giờ.**

Nói cách khác, ngay cả ở khoảnh khắc sắp kết thúc, nếu có ai đó hoàn tất khoản đầu tư từ 100 USDT trở lên, thế cờ sẽ lại bị lật ngược.

👑 **Khoảnh khắc bạn trở thành nhà đầu tư cuối cùng**
Khi được đăng ký làm nhà đầu tư cuối cùng, một phần ID của bạn sẽ được ẩn đi và hiển thị theo thời gian thực trên banner màn hình chính.
*(Ví dụ: abc**)*

Nghĩa là, mọi thành viên đều có thể thấy ngay ai đang chiếm giữ ngai vàng.

Nhưng chưa dừng lại ở đó. Điều thực sự quan trọng không phải là leo lên, mà là trụ lại đến cùng.
Nếu một thành viên khác đầu tư lại trước khi đồng hồ kết thúc, nhà đầu tư cuối cùng sẽ ngay lập tức thay đổi và đồng hồ cũng sẽ được khởi tạo lại.

🏆 **Điều kiện chiến thắng**
Điều kiện chiến thắng rất đơn giản.

Sau khi một thành viên trở thành nhà đầu tư cuối cùng, nếu trong 24 giờ không có ai đầu tư thêm từ 100 USDT trở lên khiến đồng hồ đếm ngược về 00:00:00, nhà đầu tư cuối cùng tại thời điểm đó sẽ là người chiến thắng chung cuộc.

Và thành viên đó sẽ giành được **toàn bộ số tiền thưởng jackpot tích lũy**.

🔥 **Điểm cốt lõi của sự kiện lần này**
**Không phải trò chơi cá nhân — Bổ sung tính năng đồng đội**

Đặc điểm lớn nhất của Last Man Jackpot lần này là nó không chỉ là một sự kiện dành cho cá nhân.

Nếu một đối tác trong tuyến dưới của bạn trở thành nhà đầu tư cuối cùng và trúng jackpot, phần thưởng sẽ không chỉ dừng lại ở người trúng giải.
**'Phần thưởng Roll-up Chúc mừng'** sẽ được trao cho tuyến người bảo trợ phía trên đã tạo ra người trúng jackpot, áp dụng tính năng chơi theo nhóm.

Nói cách khác:
**Ngay cả khi bạn không trực tiếp trở thành nhà đầu tư cuối cùng, nếu đối tác trong nhóm của bạn trúng jackpot, tuyến người bảo trợ phía trên cũng có thể cùng nhận phần thưởng.**

Giờ đây, Last Man Jackpot không chỉ là trò chơi "Mình có ăn được hay không", mà là cuộc chiến "Đội mình sẽ lấy jackpot hay nhường cho đội khác".

Đây mới chính là điểm thú vị thực sự. Trông có vẻ như đấu cá nhân nhưng thực chất là trận chiến đồng đội.

💰 **Thông tin thưởng Roll-up Đồng đội**
Khi có người trúng jackpot, tuyến người bảo trợ phía trên đã tạo ra người trúng thưởng sẽ tự động nhận được phần thưởng roll-up chúc mừng theo tiêu chuẩn của hệ thống.
- **Bản thân người trúng giải**: Nhận giải thưởng Jackpot
- **Tuyến người bảo trợ phía trên**: Nhận thưởng Roll-up chúc mừng

Tỷ lệ phân chia chi tiết sẽ được phản ánh tự động theo tiêu chuẩn hệ thống và phần thưởng sẽ được áp dụng bình thường vào thời điểm xảy ra trúng thưởng.

Nói tóm lại, đây là cơ cấu mà cả đội có thể cùng cười nếu đội của bạn có người trúng giải.

💡 **Mẹo chinh phục Last Man Jackpot**
Sẽ rất đáng tiếc nếu chỉ chơi sự kiện này bằng cảm giác. Sẽ thú vị hơn nhiều nếu bạn biết các điểm mấu chốt.

**1. Hãy theo dõi đồng hồ đến cùng**
Khi thời gian không còn nhiều, ai là người vào cuối cùng sẽ quyết định chiến thắng. Những phút, những giây cuối cùng chính là chìa khóa.
**2. Hãy xem đây là trận chiến đồng đội, không phải cá nhân**
Dù bạn không tự tay giành được, nhưng nếu đối tác tuyến dưới giành được, phần thưởng sẽ được liên kết với tuyến trên. Tức là đội càng hoạt động, bạn càng mạnh.
**3. Đừng nhường jackpot cho đội khác**
Sẽ thật lãng phí nếu để tuyến khác lấy mất khi đồng hồ sắp hết. Việc phối hợp cùng các đối tác trong đội để canh thời điểm là rất quan trọng.
**4. Thời điểm cuối cùng là tất cả**
Dù vào sớm đến đâu, nếu không giữ được đến cuối thì cũng kết thúc. Ngược lại, nếu vào đúng khoảnh khắc quyết định, bạn có thể lật ngược thế cờ trong nháy mắt.

📌 **Những điều cần lưu ý**
- Việc tham gia sự kiện và làm mới đồng hồ chỉ được công nhận khi đầu tư từ 100 USDT trở lên.
- Trở thành nhà đầu tư cuối cùng không có nghĩa là bạn chắc chắn đã trúng giải.
- Nếu một thành viên khác đầu tư thêm từ 100 USDT trở lên trước khi đồng hồ kết thúc, nhà đầu tư cuối cùng sẽ ngay lập tức thay đổi.
- Đồng thời, đồng hồ đếm ngược cũng sẽ được đặt lại thành 24 giờ.
- Cuối cùng, 1 nhà đầu tư cuối cùng tại thời điểm đồng hồ kết thúc sẽ là chủ nhân của giải thưởng jackpot.
- Ngoài ra, phần thưởng roll-up đồng đội sẽ được áp dụng cùng lúc cho tuyến người bảo trợ phía trên đã tạo ra người trúng thưởng.

🚀 **Lời kết**
Last Man Jackpot không phải là một sự kiện đơn giản.

Sẽ có người chiếm lấy ngai vàng ở khoảnh khắc cuối cùng,
sẽ có người trụ lại để bảo vệ ngai vàng đó,
và sẽ có người cùng đối tác trong đội hướng tới những phần thưởng lớn hơn.

Bây giờ, chỉ có một điều quan trọng.

Ai sẽ là người cuối cùng?
Và đội nào sẽ mang về vinh quang của giải jackpot khổng lồ này?

Hãy kiểm tra ngay banner jackpot trên màn hình chính, giành lại vị trí người trúng thưởng dự kiến hiện tại và mang vinh quang jackpot về cho bạn và đội của bạn.

Xin cảm ơn.

Đội ngũ vận hành DEEDRA`;

  const title_th = "📣 [ประกาศ] กิจกรรมพิเศษระดับเมกะ: Last Man Jackpot เปิดอย่างเป็นทางการแล้ว!";
  const content_th = `สวัสดี 
นี่คือ DEEDRA

กิจกรรมพิเศษระดับเมกะที่จะทำให้หัวใจคุณเต้นแรง **Last Man Jackpot** ได้เปิดตัวอย่างเป็นทางการบนหน้าจอหลักแล้ว

Last Man Jackpot ไม่ใช่แค่เกมแห่งโชคชะตา 
แต่มันคือเกมชิงไหวชิงพริบสุดพิเศษของ DEEDRA ที่จังหวะเวลา การตัดสินใจ และการทำงานเป็นทีมคือตัวตัดสินผู้ชนะ

ใครจะยึดตำแหน่งสุดท้ายได้ และใครจะปกป้องตำแหน่งนั้นไว้ได้จนถึงวินาทีสุดท้าย จะเป็นผู้กำหนดเจ้าของรางวัลแจ็คพอตสะสมมหาศาล

🎰 **Last Man Jackpot คืออะไร?**
ข้อมูลต่อไปนี้จะแสดงแบบเรียลไทม์ที่ด้านบนของหน้าจอหลัก:
- รางวัลแจ็คพอตสะสมปัจจุบัน
- ตัวนับเวลาถอยหลัง 24 ชั่วโมง
- นักลงทุนคนสุดท้ายปัจจุบัน (ผู้มีสิทธิ์ชนะ)

วินาทีที่ตัวจับเวลานี้ถึง 00:00:00 **นักลงทุนคนสุดท้ายเพียง 1 คน**ที่ถูกบันทึกในระบบจะได้รับรางวัลแจ็คพอตสะสมทั้งหมด 

พูดง่ายๆ คือ ผู้ที่ยืนหยัดเป็นคนเดียวและคนสุดท้ายจะเป็นเจ้าของเงินรางวัลทั้งหมด

⏰ **วิธีเข้าร่วมและกฎการรีเซ็ตเวลา**
การเข้าร่วม Last Man Jackpot จะเป็นไปโดยอัตโนมัติโดยไม่ต้องสมัครแยกต่างหาก

คุณจะเข้าร่วมกิจกรรมโดยอัตโนมัติหากตรงตามเงื่อนไขต่อไปนี้:
- ลงทุน FREEZE 100 USDT ขึ้นไป
- นำผลกำไรไปลงทุนซ้ำ 100 USDT ขึ้นไป

และทันทีที่มีคนลงทุนสำเร็จตามเงื่อนไขดังกล่าว:
**นักลงทุนคนสุดท้ายคนก่อนหน้าจะถูกดันออกไป นักลงทุนคนใหม่จะถูกลงทะเบียนเป็นผู้มีสิทธิ์ชนะคนใหม่ และตัวนับเวลาถอยหลังจะรีเซ็ตกลับไปเป็น 24 ชั่วโมงอีกครั้ง**

กล่าวคือ แม้ในช่วงเวลาที่ใกล้จะจบลง หากมีคนอื่นลงทุน 100 USDT ขึ้นไปสำเร็จ เกมก็จะพลิกกลับอีกครั้ง

👑 **วินาทีที่คุณกลายเป็นนักลงทุนคนสุดท้าย**
เมื่อคุณได้รับการลงทะเบียนเป็นนักลงทุนคนสุดท้าย ไอดีของคุณบางส่วนจะถูกซ่อนไว้และแสดงแบบเรียลไทม์บนแบนเนอร์หน้าจอหลัก
*(ตัวอย่าง: abc**)*

ซึ่งหมายความว่าสมาชิกทุกคนสามารถเห็นได้ทันทีว่าใครกำลังครองบัลลังก์อยู่ในขณะนี้

แต่มันยังไม่จบเพียงแค่นี้ สิ่งที่สำคัญจริงๆ ไม่ใช่การได้ขึ้นไป แต่เป็นการยืนหยัดให้ถึงที่สุด
หากสมาชิกคนอื่นลงทุนอีกครั้งก่อนที่เวลาจะหมด นักลงทุนคนสุดท้ายจะเปลี่ยนทันที และตัวจับเวลาจะถูกรีเซ็ตอีกครั้ง

🏆 **เงื่อนไขการชนะ**
เงื่อนไขการชนะนั้นง่ายมาก

หลังจากที่สมาชิกกลายเป็นนักลงทุนคนสุดท้าย หากไม่มีใครลงทุนเพิ่ม 100 USDT ขึ้นไปเป็นเวลา 24 ชั่วโมง จนตัวจับเวลาถึง 00:00:00 นักลงทุนคนสุดท้าย ณ เวลานั้นจะเป็นผู้ชนะคนสุดท้าย

และสมาชิกคนนั้นจะได้รับ**รางวัลแจ็คพอตสะสมทั้งหมด**

🔥 **หัวใจสำคัญของกิจกรรมนี้**
**ไม่ใช่เกมเดี่ยว — เพิ่มฟีเจอร์การเล่นแบบทีม**

คุณสมบัติที่ใหญ่ที่สุดของ Last Man Jackpot นี้คือไม่ใช่แค่กิจกรรมที่เป้าหมายอยู่ที่ตัวบุคคลเท่านั้น

หากพาร์ทเนอร์ในสายงานดาวน์ไลน์ของคุณกลายเป็นนักลงทุนคนสุดท้ายและถูกรางวัลแจ็คพอต รางวัลจะไม่ได้จบแค่ที่ผู้ชนะ
**'โบนัส Roll-up แสดงความยินดี'** จะถูกจ่ายให้กับสายผู้แนะนำระดับสูงที่สร้างผู้ชนะแจ็คพอต ซึ่งเป็นการใช้ฟีเจอร์การเล่นแบบทีม

พูดอีกอย่างก็คือ:
**แม้ว่าคุณจะไม่ได้เป็นนักลงทุนคนสุดท้ายด้วยตัวเอง แต่ถ้าพาร์ทเนอร์ในทีมของคุณประสบความสำเร็จในการคว้าแจ็คพอต สายผู้แนะนำระดับสูงก็สามารถรับรางวัลร่วมกันได้**

ตอนนี้ Last Man Jackpot ไม่ใช่แค่เกมที่ว่า "ฉันจะได้มันหรือเปล่า" แต่เป็นการต่อสู้ว่า "ทีมของเราจะคว้าแจ็คพอต หรือจะยอมยกให้ทีมอื่น"

นี่คือจุดที่สนุกจริงๆ มันดูเหมือนการแข่งขันเดี่ยว แต่แท้จริงแล้วมันคือการต่อสู้แบบทีม

💰 **ข้อมูลโบนัส Roll-up แบบทีม**
เมื่อมีผู้ชนะแจ็คพอต โบนัส Roll-up แสดงความยินดีจะถูกปรับใช้อัตโนมัติกับสายผู้แนะนำระดับสูงที่สร้างผู้ชนะตามมาตรฐานของระบบ
- **ตัวผู้ชนะ**: ได้รับเงินรางวัลแจ็คพอต
- **สายผู้แนะนำระดับสูง**: จ่ายโบนัส Roll-up แสดงความยินดี

อัตราส่วนการกระจายที่ละเอียดจะสะท้อนโดยอัตโนมัติตามมาตรฐานระบบ และรางวัลจะถูกปรับใช้อย่างปกติในเวลาที่เกิดการชนะ

กล่าวโดยสรุปคือ เป็นโครงสร้างที่ทั้งทีมสามารถยิ้มร่วมกันได้หากมีผู้ชนะมาจากทีมของคุณ

💡 **เคล็ดลับการพิชิต Last Man Jackpot**
มันน่าเสียดายถ้าจะเล่นกิจกรรมนี้ด้วยความรู้สึกเพียงอย่างเดียว มันจะสนุกกว่ามากถ้ารู้จุดสำคัญ

**1. จับตาดูเวลาให้ดีจนถึงที่สุด**
เมื่อเวลาเหลือน้อย ใครเข้ามาเป็นคนสุดท้ายจะเป็นตัวตัดสินผู้ชนะ นาทีและวินาทีสุดท้ายคือหัวใจสำคัญ
**2. มองว่านี่คือการต่อสู้แบบทีม ไม่ใช่แบบเดี่ยว**
แม้คุณจะคว้าไม่ได้เอง แต่ถ้าพาร์ทเนอร์สายงานล่างคว้าได้ รางวัลก็จะเชื่อมโยงไปยังสายงานบน สรุปคือ ยิ่งทีมเคลื่อนไหวมากเท่าไหร่ คุณก็จะยิ่งแข็งแกร่งขึ้น
**3. อย่ายกแจ็คพอตให้ทีมอื่น**
มันน่าเสียดายมากที่จะปล่อยให้สายงานอื่นเอาไปเมื่อเวลาใกล้จะหมด สิ่งสำคัญคือการเคลื่อนไหวร่วมกับพาร์ทเนอร์ในทีมโดยดูจังหวะเวลาให้ดี
**4. จังหวะสุดท้ายคือทุกสิ่ง**
ไม่ว่าจะเข้ามาเร็วแค่ไหน ถ้าปกป้องตอนจบไม่ได้ก็จบกัน ในทางกลับกัน การเข้ามาในช่วงเวลาตัดสินสามารถพลิกเกมได้ในพริบตา

📌 **สิ่งที่ต้องรู้**
- การเข้าร่วมกิจกรรมและการรีเซ็ตเวลาจะได้รับการยอมรับเมื่อลงทุน 100 USDT ขึ้นไปเท่านั้น
- การเป็นนักลงทุนคนสุดท้ายไม่ได้หมายความว่าคุณจะได้รับการยืนยันว่าชนะทันที
- หากสมาชิกคนอื่นลงทุนเพิ่ม 100 USDT ขึ้นไปก่อนที่เวลาจะหมด นักลงทุนคนสุดท้ายจะเปลี่ยนทันที
- ในเวลาเดียวกัน ตัวนับเวลาถอยหลังจะรีเซ็ตเป็น 24 ชั่วโมงอีกครั้ง
- ท้ายที่สุด นักลงทุนคนสุดท้าย 1 คน ณ เวลาที่ตัวจับเวลาสิ้นสุดลง จะเป็นเจ้าของเงินรางวัลแจ็คพอต
- นอกจากนี้ โบนัส Roll-up แบบทีมจะถูกนำไปใช้ร่วมกับสายผู้แนะนำระดับสูงที่สร้างผู้ชนะด้วย

🚀 **บทส่งท้าย**
Last Man Jackpot ไม่ใช่กิจกรรมธรรมดา

บางคนจะยึดครองบัลลังก์ในวินาทีสุดท้าย
บางคนจะยืนหยัดเพื่อปกป้องบัลลังก์นั้น
และบางคนจะมุ่งเป้าไปที่รางวัลที่ใหญ่กว่าร่วมกับพาร์ทเนอร์ในทีมของตน

ตอนนี้ สิ่งสำคัญมีเพียงสิ่งเดียว

ใครจะเป็นคนสุดท้าย?
และทีมใดจะคว้าความรุ่งโรจน์ของแจ็คพอตมหาศาลนี้ไปครอง?

ตรวจสอบแบนเนอร์แจ็คพอตบนหน้าจอหลักตอนนี้ แย่งชิงตำแหน่งผู้มีสิทธิ์ชนะคนปัจจุบัน และนำความรุ่งโรจน์ของแจ็คพอตมาสู่คุณและทีมของคุณ

ขอบคุณ

ทีมงานปฏิบัติการ DEEDRA`;

  await targetDoc.ref.update({
    title_en, content_en,
    title_vi, content_vi,
    title_th, content_th
  });
  
  console.log('Successfully updated announcement with high quality translations!');
  process.exit(0);
}

run();
