# 🚀 ZaloEdu - Nền tảng Giáo dục Trực tuyến (Monorepo)

Dự án này là hệ thống học tập và liên lạc trực tuyến đa nền tảng, được chia thành phần **Web App**, **Mobile App**, và **Backend** chạy trên cùng một Repository sử dụng kiến trúc Monorepo (NPM Workspaces). Hệ thống đã được tích hợp đầy đủ môi trường Cloud AWS và được thiết kế Single-Table DynamoDB.

## 📦 Kiến trúc & Công nghệ (Tech Stack)

### 1. Nền tảng Frontend
- **Web (`apps/web`)**: React 18, Vite, React Router, TailwindCSS v4, SweetAlert2.
- **Mobile (`apps/mobile`)**: React Native, Expo, React Navigation.
- **Shared (`packages/shared`)**: Nơi lưu giữ Typescript Interfaces và Data Transfer Objects dùng chung đồng bộ giữa Client và Server.

### 2. Backend & Cloud Infrastructure (`backend/`)
- **Server**: NestJS (Node.js).
- **Cơ sở dữ liệu**: AWS DynamoDB (Thiết kế Single Table linh hoạt cho quy mô lớn).
- **Lưu trữ tĩnh (Media)**: AWS S3 (Cho ảnh đại diện, file gửi luồng chat).
- **Caching & Session**: Redis.
- **Bảo mật**: `bcrypt` (hash mật khẩu an toàn, không lưu text thuần).
- **Dịch vụ Email**: Nodemailer xử lý module OTP gửi qua hòm thư điện tử.

---

## 🔒 Hướng dẫn cài đặt cho thành viên mới (Onboarding Guide)

### Bước 1: Clone dự án và cài đặt Dependencies
Dự án dùng tính năng `workspaces` của NPM. Vì vậy bạn chỉ cần chạy cài đặt một lần duy nhất tại thư mục gốc!
```bash
git clone <URL_CUA_REPO_GITHUB>
cd BTL_ZaloForEducation
npm install
```

### Bước 2: Khởi tạo biến môi trường (.env)
> ⛔ **Cảnh báo bảo mật**: KHÔNG BAO GIỜ commit các file `.env` lên phân hệ Version Control vì sẽ làm rò rỉ Key AWS. Mã nguồn hiện được bảo vệ bằng file `.gitignore` tự động chặn đuôi `.env`.

Xin thông tin AWS/Redis keys ở người giữ Database để làm bản clone. Sau đó, **tạo các file `.env` mới trong từng thư mục** với cấu trúc sau:

**1. `backend/.env`**
```env
PORT=3000
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=***** (Điền key thực)
AWS_SECRET_ACCESS_KEY=***** (Điền key thực)
DYNAMODB_TABLE_NAME=ZaloEdu-Table
REDIS_HOST=*** (Điền host Redis)
REDIS_PORT=*** 
REDIS_PASSWORD=***
JWT_SECRET=zaloedu_super_secret_2026
SMTP_USER=admin@gmail.com
SMTP_PASS=**** (App Password của Gmail)
```

**2. `apps/web/.env`**
```env
VITE_API_URL=http://localhost:3000
```

**3. `apps/mobile/.env`**
*(Lưu ý: Bạn bắt buộc phải lấy địa chỉ IP LAN nhà mình ví dụ 192.168.1.x thay thế thì chạy trên điện thoại thật mới nối được).*
```env
EXPO_PUBLIC_API_URL=http://<IP_MANG_CUA_BAN>:3000
```

### Bước 3: Thiết lập AWS DynamoDB (Bắt buộc)
Dự án sử dụng mô hình **Single-Table Design** (không tách từng bảng rời rạc như SQL). Mọi dữ liệu (Users, Sessions, Messages, v.v.) đều nằm chung một bảng duy nhất để tối ưu hiệu năng Query và tiết kiệm chi phí trên Cloud.

Các thành viên khi setup hạ tầng trên AWS Console cần tạo đúng một bảng duy nhất với cấu hình cốt lõi sau:
- **Table name**: `ZaloEdu-Table` (tương ứng với biến `DYNAMODB_TABLE_NAME` trong `.env`)
- **Partition key**: Nhập tên là `PK` (Chọn kiểu dữ liệu `String`)
- **Sort key**: Nhập tên là `SK` (Chọn kiểu dữ liệu `String`)
- **Capacity mode**: Đề xuất chọn `On-demand` trong giai đoạn phát triển.

> **💡 Giải thích:** Bạn tuyệt đối KHÔNG tự tạo thủ công các bảng như `Users`, `Chats`. Hệ thống code Backend sẽ tự phân loại dữ liệu dựa theo tiền tố của khóa. Ví dụ một User sẽ có dạng `PK: USER#admin@gmail.com` và `SK: METADATA`.

### Bước 4: Chạy dự án ở hệ thống nội bộ

Trong thư mục gốc, dự án đã setup sẵn script (Hãy mở 3 tab terminal để theo dõi log riêng rẽ):

- Chạy máy chủ Cloud Backend:
  ```bash
  npm run backend:dev
  ```
- Khởi động giao diện Website:
  ```bash
  npm run web:dev
  ```
- Khởi động Expo trên Điện thoại (Bật app Expo Go quét mã QR):
  ```bash
  npm run mobile:dev
  ```

---

## 📈 Kế hoạch phát triển tiếp theo (Development Roadmap)

Nền tảng kiến trúc (Xác thực với Web/App, Bảo mật OTP, Cấu hình kết nối AWS/DB/Redis) đã được hoàn thiện. 
Team cần bắt tay phối hợp xây dựng các Core Features tiếp theo:

### 🌟 1. Module Liên lạc (Chat & Real-time) - Ưu tiên Cao nhất
- **Backend:** Cần lập trình `Socket.io` trong NestJS (`ChatGateway`) cho luồng Push Message. Xây dựng Sơ đồ Query trên DynamoDB cho Chat Message (Sử dụng GSI phù hợp để query thời gian thực).
- **Client (Web/Mobile):** Cài đặt Socket.io-client. Làm giao diện khung chat hỗ trợ nhận tin gửi hình ảnh qua Cloud S3.

### 🌟 2. Quản lý danh bạ & Tìm kiếm
- Xây dựng API gửi lời mời kết bạn bằng số điện thoại (Phone Search). Dựng luồng Accept/Deny cơ bản lưu vào Redis Real-time trước khi push Dynamo.

### 🌟 3. Cập nhật hồ sơ & Upload ảnh (S3 Service)
- Mảnh ghép `S3Service` ở Backend đã được tạo, cần tạo endpoint cho Mobile/Web POST file ảnh (multipart/form-data).
- Cập nhật màn hình Thông tin Cá nhân ở phía Client hỗ trợ chọn ảnh lưu dưới dạng định dạng Image chuẩn.

### 🌟 4. Tối ưu User Experience (UX/UI Phụ trợ)
- Các Component như Mobile Button, Mobile Input đã được làm chuẩn hóa. Thêm hiệu ứng micro-interactions (hoạt ảnh lúc submit form/nhấn nút tim).
- Tích hợp thêm Socket cho Push Notification mỗi khi có tin nhắn gửi lúc không mở app.

> Chúc cả team lập trình dự án thật tốt đẹp! Mọi khó khăn ở module AWS, hãy liên hệ Leader.
