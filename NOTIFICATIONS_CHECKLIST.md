## 📋 NOTIFICATIONS FEATURE - CHECKLIST

### ✅ ĐÃ HOÀN THÀNH

#### 1. **Database Schema** 
- [x] Prisma schema với Notification model đầy đủ
- [x] DeviceToken model để lưu FCM tokens
- [x] NotificationType enum (COMMENT_REPLY, MENTION)

#### 2. **Backend API Endpoints**
- [x] `GET /notifications` - Lấy danh sách thông báo (có pagination, filter)
- [x] `GET /notifications/count` - Đếm thông báo chưa đọc
- [x] `PATCH /notifications/:id/read` - Đánh dấu 1 thông báo đã đọc
- [x] `POST /notifications/mark-read` - Đánh dấu nhiều thông báo đã đọc
- [x] `POST /devices/register` - Mobile đăng ký device token (FCM)

#### 3. **Services & Logic**
- [x] NotificationsService - CRUD notifications + query
- [x] NotificationsHelper - Trigger notifications cho các sự kiện
- [x] DeviceTokenService - Manage FCM tokens
- [x] CommentsService - Trigger notification khi reply comment
- [x] Error handling trong tất cả endpoints
- [x] Swagger documentation (ApiProperty, ApiTags)

#### 4. **Code Quality**
- [x] Inject PrismaService đúng cách (không dùng `prisma: any`)
- [x] Module imports/exports đúng
- [x] Logger cho debug
- [x] Type-safe DTOs

---

### ❌ CÒN THIẾU (Phạm vi BE)

#### 1. **Firebase Cloud Messaging (FCM) Integration**
- [ ] Setup Firebase Admin SDK
- [ ] Service để gửi push notifications qua FCM
- [ ] Handle FCM token refresh & errors
- [ ] Mark notification as_sent sau khi push thành công

#### 2. **Push Notification Trigger**
- [ ] Sau khi tạo notification, gọi FCM để push tới device
- [ ] Batch push nếu nhiều users
- [ ] Handle offline users (queue notifications)

#### 3. **Additional Notification Events** (tùy chọn)
- [ ] Mention notifications
- [ ] Rating notifications  
- [ ] Watchlist updates
- [ ] System announcements

#### 4. **Admin Endpoints** (tùy chọn)
- [ ] Send manual notifications to users
- [ ] View notification stats
- [ ] Template notifications

#### 5. **Database Migration**
- [ ] Chạy `npx prisma migrate dev` để apply schema

---

### 📝 MOBILE ANDROID CẦN BIẾT

#### Request Example: Đăng ký device token
```bash
POST /devices/register
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "token": "fcm_device_token_from_firebase",
  "platform": "android",
  "deviceId": "optional_device_id"
}

Response: 
{
  "success": true,
  "tokenId": "uuid"
}
```

#### Request Example: Lấy danh sách thông báo
```bash
GET /notifications?page=1&limit=20&unread=false
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "items": [
    {
      "id": "uuid",
      "type": "COMMENT_REPLY",
      "title": "Tên người reply đã trả lời bình luận của bạn",
      "body": "...",
      "is_read": false,
      "actorId": "uuid",
      "sourceId": "comment_id",
      "movieId": 550,
      "data": {
        "deeplink": "movie/550/comments/parent_comment_id",
        "commentId": "parent_comment_id",
        "replyCommentId": "new_reply_id",
        "type": "COMMENT_REPLY"
      },
      "is_sent": true,
      "sent_at": "2025-01-07T10:00:00Z",
      "createdAt": "2025-01-07T10:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

#### Request Example: Đánh dấu thông báo đã đọc
```bash
PATCH /notifications/uuid/read
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "success": true
}
```

---

### 🔧 NEXT STEPS

**Bước tiếp theo để hoàn thành feature:**

1. **Setup Firebase Admin SDK**
   - Tài khoản Google Cloud & Firebase project
   - Download service account key
   - Install `firebase-admin` package

2. **Tạo FCM Service**
   ```
   src/fcm/fcm.service.ts
   src/fcm/fcm.module.ts
   ```

3. **Tạo Queue/Event để async push**
   - Dùng `@nestjs/bull` + Redis hoặc
   - Simple async call (nếu không critical)

4. **Test API**
   - Register device token từ mobile
   - Create comment reply
   - Verify notification created + pushed

5. **Deploy & Monitor**
   - Check error logs từ FCM
   - Monitor notification delivery rate

---

### 💾 CẤU HÌNH HIỆN TẠI

- **Database**: PostgreSQL (Prisma)
- **Authentication**: JWT + PassportJS
- **API Framework**: NestJS
- **Real-time**: Socket.io (chat gateway)
- **Push Notifications**: Firebase Cloud Messaging (TODO)

---

### 📎 CÁC FILES ĐÃ CHỈNH SỬA

✅ `src/notifications/notifications.service.ts` - Inject PrismaService, thêm createNotification methods
✅ `src/notifications/notifications.controller.ts` - Thêm error handling, Logger
✅ `src/notifications/notifications.module.ts` - Import PrismaModule, export services
✅ `src/notifications/notifications.helper.ts` - NEW: Helper để trigger notifications
✅ `src/notifications/dto/notification-response.dto.ts` - Thêm swagger decorators, fields
✅ `src/comments/comments.service.ts` - Inject NotificationsHelper, trigger notification
✅ `src/comments/comments.module.ts` - Import NotificationsModule

---

### 🎯 TÓNG TẮT TRạNG THÁI

**Mục đích**: Cấp tính năng thông báo cho mobile Android Java

**Trạng thái**: ✅ **80% hoàn thành** - Các API + logic để tạo & quản lý notifications đã xong. 
**Còn lại**: ⏳ **20%** - Setup FCM để thực tế push notifications tới device

**Có thể test ngay**: API endpoints đã có, chỉ chưa nhận push notification trên device (vì chưa có FCM)
