import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';
type Language = 'vi' | 'en';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'app_theme_mode';
const LANGUAGE_KEY = 'app_language';

// Translations
const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Navigation
    'nav.back': 'Quay lại',
    'nav.settings': 'Cài đặt',
    'nav.experience': 'UniChat Experience',

    // Headers
    'header.title': 'Tuỳ chỉnh ứng dụng',
    'header.description': 'Mọi thay đổi sẽ được lưu cục bộ trên trình duyệt này và đồng bộ hoá khi bạn đăng nhập trên các thiết bị UniChat khác.',
    'header.search_messages': 'Tìm kiếm tin nhắn...',
    'header.view_profile': 'Xem trang cá nhân',
    'header.members_count': '{count} thành viên',
    'header.active': 'Đang hoạt động',
    'header.offline': 'Ngoại tuyến',
    'header.video_call_group': 'Cuộc gọi video nhóm',
    'header.video_call_direct': 'Cuộc gọi video',
    'header.voice_call_group': 'Cuộc gọi thoại nhóm',
    'header.voice_call_direct': 'Cuộc gọi thoại',
    'header.ongoing_call': 'Cuộc gọi đang diễn ra ({count} người tham gia)',
    'header.search_min_chars': 'Nhập ít nhất 2 ký tự để tìm kiếm tin nhắn',
    'header.searching': 'Đang tìm kiếm...',
    'header.no_messages_found': 'Không tìm thấy tin nhắn nào chứa "{query}"',
    'header.search_results': 'Kết quả tìm kiếm ({count})',

    // Sections
    'section.account': 'Tài khoản & Bảo mật',
    'section.account_subtitle': 'Quản lý các thiết bị và phương thức bảo vệ tài khoản',
    'section.privacy': 'Quyền riêng tư',
    'section.privacy_subtitle': 'Kiểm soát những gì người khác thấy về bạn',
    'section.notifications': 'Thông báo',
    'section.notifications_subtitle': 'Cài đặt âm thanh và cách nhận tin nhắn',
    'section.media': 'Dữ liệu & Media',
    'section.media_subtitle': 'Quản lý cách ứng dụng xử lý file và bộ nhớ',
    'section.theme': 'Giao diện & Ngôn ngữ',
    'section.theme_subtitle': 'Tùy chỉnh phong cách hiển thị ứng dụng',
    'section.account_management': 'Quản lý tài khoản',
    'section.account_management_subtitle': 'Các thao tác không thể hoàn tác. Vui lòng cân nhắc kỹ trước khi thực hiện.',

    // Account & Security Section
    'account.devices': 'Thiết bị đăng nhập',
    'account.devices_desc': 'Hiện tại bạn đang đăng nhập trên {count} thiết bị.',
    'account.manage_sessions': 'Quản lý phiên ngay',
    'account.change_password': 'Đổi mật khẩu',
    'account.change_password_desc': 'Cập nhật mật khẩu thường xuyên để đảm bảo an toàn tối đa.',

    // Privacy Section
    'privacy.online_status': 'Trạng thái hoạt động',
    'privacy.online_status_desc': 'Cho phép bạn bè thấy khi nào bạn đang online.',
    'privacy.phone_search': 'Tìm kiếm qua số điện thoại',
    'privacy.phone_search_desc': 'Cho phép người lạ tìm thấy bạn thông qua số điện thoại.',
    'privacy.sync_contacts': 'Đồng bộ danh bạ',
    'privacy.sync_contacts_desc': 'Tự động đồng bộ các liên hệ mới từ danh bạ của bạn.',

    // Notifications Section
    'notif.push': 'Thông báo đẩy',
    'notif.push_desc': 'Nhận thông báo ngay lập tức trên màn hình desktop.',
    'notif.sound': 'Âm thanh thông báo',
    'notif.sound_desc': 'Phát âm báo khi có tin nhắn mới hoặc cuộc gọi.',

    // Media Section
    'media.auto_download': 'Tự động tải media',
    'media.auto_download_desc': 'Tự động lưu ảnh và video về bộ nhớ tạm của trình duyệt.',

    // Theme & Language Section
    'theme.label': 'Chủ đề giao diện',
    'theme.system': 'Hệ thống',
    'theme.light': 'Sáng',
    'theme.dark': 'Tối',
    'language.label': 'Ngôn ngữ ứng dụng',
    'language.vi': 'Tiếng Việt',
    'language.en': 'English',

    // Chat Wallpaper Settings
    'info.change_wallpaper': 'Thay đổi hình nền',
    'wallpaper.modal_title': 'Thay đổi hình nền',
    'wallpaper.save': 'Lưu thay đổi',
    'wallpaper.cancel': 'Hủy',
    'wallpaper.study_meadow': 'Đồng cỏ học tập',
    'wallpaper.math_orbit': 'Quỹ đạo toán học',
    'wallpaper.library_horizon': 'Chân trời thư viện',
    'wallpaper.science_lab': 'Phòng thí nghiệm',
    'wallpaper.world_classroom': 'Lớp học thế giới',

    // Account Management Section
    'account_mgmt.lock': 'Khóa tài khoản',
    'account_mgmt.lock_desc': 'Tạm dừng truy cập. Tài khoản có thể được mở khóa sau.',
    'account_mgmt.delete': 'Xóa tài khoản',
    'account_mgmt.delete_desc': 'Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu liên quan.',

    // Footer
    'footer.version': 'UniChat v1.0.0 Alpha',
    'footer.note': 'Hệ thống giáo dục nội bộ. Các thiết lập giao diện chỉ có hiệu lực trên trình duyệt này.',

    // Modals
    'modal.change_password': 'Đổi mật khẩu',
    'modal.verify_otp': 'Xác thực OTP',
    'modal.current_password': 'Mật khẩu hiện tại',
    'modal.new_password': 'Mật khẩu mới',
    'modal.confirm_password': 'Xác nhận mật khẩu mới',
    'modal.send_otp': 'Gửi mã xác thực',
    'modal.confirm': 'Xác nhận',
    'modal.back': 'Quay lại bước trước',
    'modal.lock_account': 'Khóa tài khoản',
    'modal.delete_account': 'Xóa tài khoản',
    'modal.verify_password': 'Vui lòng xác thực mật khẩu hiện tại để tiếp tục.',
    'modal.otp_sent': 'Mã xác thực đã được gửi tới email: {email}',
    'modal.password_mismatch': 'Mật khẩu xác nhận không khớp.',
    'modal.error': 'Có lỗi xảy ra, vui lòng thử lại.',
    'modal.invalid_otp': 'Mã OTP không chính xác.',

    // Auth events (used by AuthContext outside React tree)
    'auth.session_expired': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    'auth.friend_request_new': 'Bạn có lời mời kết bạn mới!',
    'auth.friend_request_new_text': 'Một người dùng đã gửi lời mời kết bạn cho bạn.',
    'auth.lock_success': 'Tài khoản của bạn đã được khóa thành công.',
    'auth.delete_success': 'Tài khoản của bạn đã được xóa vĩnh viễn.',

    // Call events
    'call.video_upgrade_declined': 'Yêu cầu nâng cấp cuộc gọi video đã bị từ chối.',
    'call.screen_share_busy': 'Không thể chia sẻ màn hình: màn hình đang được sử dụng bởi một tiến trình khác.',
    'call.screen_share_denied': 'Quyền chia sẻ màn hình bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.',
    'call.incoming_group_call': 'Cuộc gọi nhóm đến',
    'call.group_invite_desc': 'Bạn có một lời mời tham gia cuộc gọi video nhóm',
    'call.default_group_name': 'Cuộc gọi nhóm',
    'call.decline': 'Từ chối',
    'call.join': 'Tham gia',

    // Inbox / Chat List
    'inbox.all': 'Tất cả',
    'inbox.unread': 'Chưa đọc',
    'inbox.classify': 'Phân loại',
    'inbox.mention_tag': '[@ Nhắc tên]',
    'inbox.by_status': 'Theo trạng thái',
    'inbox.by_tag': 'Theo thẻ',
    'inbox.no_tag': 'Không gắn thẻ',
    'inbox.manage_tags': 'Quản lý thẻ',
    'inbox.empty': 'Không có cuộc trò chuyện nào',
    'inbox.search_placeholder': 'Tìm kiếm tin nhắn, liên hệ...',
    'inbox.hidden_chat': 'Cuộc trò chuyện ẩn',
    'inbox.hidden_warning_title': 'Cảnh báo ẩn cuộc trò chuyện',
    'inbox.hidden_warning_text': 'Cuộc trò chuyện này đã được ẩn. Nhập mã PIN để tìm lại.',
    'inbox.hide_title': 'Ẩn cuộc trò chuyện',
    'inbox.hide_text': 'Nhập mã PIN để ẩn cuộc trò chuyện này. Bạn cần nhập mã PIN này để xem lại.',
    'inbox.pin_placeholder': 'Nhập mã PIN',
    'inbox.hide_btn': 'Ẩn',
    'inbox.cancel': 'Hủy',
    'inbox.pin_invalid': 'Mã PIN phải gồm 4 chữ số',
    'inbox.hide_success': 'Đã ẩn cuộc trò chuyện thành công',
    'inbox.unlock_title': 'Mở khóa cuộc trò chuyện',
    'inbox.unlock_text': 'Vui lòng nhập mã PIN để hiển thị cuộc trò chuyện',
    'inbox.unlock_btn': 'Mở khóa',
    'inbox.pin_wrong': 'Mã PIN không đúng, vui lòng thử lại',
    'inbox.unlock_success': 'Đã mở khóa thành công',
    'inbox.options': 'Tùy chọn',
    'inbox.pin': 'Ghim trò chuyện',
    'inbox.unpin': 'Bỏ ghim trò chuyện',
    'inbox.lock': 'Khóa cuộc trò chuyện',
    'inbox.unlock': 'Mở khóa',
    'inbox.call_video_out': 'Cuộc gọi video đi',
    'inbox.call_video_in': 'Cuộc gọi video đến',
    'inbox.call_voice_out': 'Cuộc gọi thoại đi',
    'inbox.call_voice_in': 'Cuộc gọi thoại đến',

    // Contacts Section
    'contacts.title': 'Danh bạ',
    'contacts.description': 'Quản lý danh bạ của bạn',
    'contacts.groups': 'Nhóm',
    'contacts.requests': 'Lời mời kết bạn',
    'contacts.invitations': 'Đã gửi lời mời',
    'contacts.search_placeholder': 'Tìm bạn bè...',
    'contacts.sort_name': 'Sắp xếp theo tên',
    'contacts.filter': 'Lọc',
    'contacts.filter_all': 'Tất cả',
    'contacts.filter_nickname': 'Có biệt danh',
    'contacts.filter_no_nickname': 'Không có biệt danh',
    'contacts.filter_blocked': 'Đã chặn',
    'contacts.loading': 'Đang tải...',
    'contacts.empty': 'Không có liên hệ nào.',

    // Additional Missing Keys (Vi)
    'call.join_group_error': 'Lỗi khi tham gia cuộc gọi nhóm.',
    'info.change_avatar': 'Thay đổi ảnh đại diện',
    'info.ai_assistant': 'Trợ lý AI',
    'info.archive': 'Lưu trữ',
    'info.sender': 'Người gửi',
    'info.select_date': 'Chọn ngày',
    'info.change_role_btn_title': 'Đổi quyền',
    'info.kick_btn_title': 'Mời khỏi nhóm',
    'info.appoint_owner_title': 'Nhường quyền trưởng nhóm',
    'info.appoint_owner_desc': 'Bạn có chắc muốn nhường quyền trưởng nhóm cho thành viên này?',
    'info.no_candidates': 'Không có ứng viên nào',
    'info.appoint_leave_btn': 'Nhường quyền và rời nhóm',
    'info.auto_delete_title': 'Tự động xóa tin nhắn',
    'profile_completion.invalid_phone': 'Số điện thoại không hợp lệ',
    'profile_completion.otp_sent_title': 'Đã gửi mã OTP',
    'profile_completion.otp_sent_text': 'Mã OTP đã được gửi đến email của bạn.',
    'profile_completion.otp_send_error': 'Lỗi khi gửi mã OTP',
    'profile_completion.required_info': 'Vui lòng điền đầy đủ thông tin',
    'profile_completion.invalid_birthdate': 'Ngày sinh không hợp lệ',
    'profile_completion.welcome_title': 'Chào mừng',
    'profile_completion.complete_success': 'Hoàn tất hồ sơ thành công',
    'profile_completion.complete_error': 'Lỗi khi hoàn tất hồ sơ',
    'profile.image_updated': 'Đã cập nhật ảnh đại diện',

    // Chat Sidebar Info
    'info.group_chat': 'Thông tin nhóm',
    'info.direct_chat': 'Thông tin hội thoại',
    'info.media': 'Ảnh/Video',
    'info.files': 'Tài liệu',
    'info.links': 'Liên kết',
    'info.no_media': 'Không có ảnh/video',
    'info.no_files': 'Không có tài liệu',
    'info.no_links': 'Không có liên kết',
    'info.view_all': 'Xem tất cả',
    'info.pinned_messages': 'Tin nhắn đã ghim ({count})',
    'info.recently_pinned': 'Đã ghim gần đây',
    'info.auto_delete_label': 'Tự động xóa tin nhắn',
    'info.never': 'Không bao giờ',
    'info.day_1': '1 ngày',
    'info.days_7': '7 ngày',
    'info.days_30': '30 ngày',
    'info.unpin_conversation': 'Bỏ ghim hội thoại',
    'info.pin_conversation': 'Ghim hội thoại',
    'info.delete_chat_history': 'Xóa lịch sử trò chuyện',
    'info.share_link_qr': 'Chia sẻ link & mã QR',
    'info.mute_notifications': 'Tắt thông báo',
    'info.mute_for': 'Tắt thông báo trong...',
    'info.mute_1_hour': '1 giờ',
    'info.mute_4_hours': '4 giờ',
    'info.mute_12_hours': '12 giờ',
    'info.mute_until_8am': 'Đến 8:00 sáng mai',
    'info.mute_permanent': 'Cho đến khi mở lại',
    'info.mute_custom': 'Tùy chỉnh thời gian',
    'info.mute_custom_desc': 'Chọn khoảng thời gian để tắt thông báo tự động hàng ngày',
    'info.mute_confirm_custom': 'Xác nhận khoảng thời gian',
    'info.mute_label_muted': 'Đang tắt',
    'info.mute_status_muted': 'Đang tắt thông báo',
    'info.mute_status_active': 'Đang bật thông báo',
    'info.mute_from': 'Từ',
    'info.mute_to': 'Đến',
    'info.group_mgmt': 'Quản lý nhóm',
    'info.leave_group': 'Rời nhóm',
    'info.dissolve_group': 'Giải tán nhóm',
    'info.members_count': 'Thành viên ({count})',
    'info.loading': 'Đang tải...',
    'info.group_fallback': 'Trò chuyện nhóm',
    'info.clear_title_one_side': 'Xóa trò chuyện phía bạn',
    'info.clear_text_one_side': 'Bạn có chắc chắn muốn xóa lịch sử trò chuyện từ phía mình? Hành động này không thể hoàn tác.',
    'info.delete_button': 'Xóa vĩnh viễn',
    'info.clear_success': 'Đã xóa lịch sử trò chuyện thành công',
    'info.clear_error': 'Lỗi khi xóa lịch sử trò chuyện',
    'info.retry_later': 'Vui lòng thử lại sau',
    'info.leave_error': 'Lỗi khi rời nhóm',
    'info.dissolve_title': 'Giải tán nhóm',
    'info.dissolve_text': 'Giải tán nhóm sẽ xóa tất cả thành viên và tin nhắn vĩnh viễn. Bạn có chắc chắn muốn tiếp tục?',
    'info.dissolve_button': 'Giải tán',
    'info.dissolve_error': 'Lỗi khi giải tán nhóm',
    'info.clear_history_title': 'Xóa lịch sử nhóm',
    'info.history_error': 'Lỗi xóa lịch sử',
    'info.delete_chat_everyone_text': 'Bạn muốn xóa lịch sử trò chuyện ở phía bạn hay xóa cho tất cả thành viên trong nhóm?',
    'info.delete_chat_everyone_btn': 'Xóa cho tất cả',
    'info.delete_chat_me_btn': 'Chỉ xóa phía tôi',
    'info.success': 'Thành công',
    'info.pin_error': 'Lỗi khi ghim hội thoại',
    'info.kick_title': 'Xóa thành viên',
    'info.kick_text': 'Xác nhận xóa thành viên {name} khỏi nhóm?',
    'info.remove_button': 'Xóa khỏi nhóm',
    'info.remove_error': 'Không thể xóa thành viên',
    'info.change_role_title': 'Thay đổi vai trò thành viên',
    'info.role_member': 'Thành viên',
    'info.role_deputy': 'Phó nhóm',
    'info.role_owner': 'Trưởng nhóm',
    'info.owner': 'Trưởng nhóm',
    'info.deputy': 'Phó nhóm',
    'info.member': 'Thành viên',
    'info.saving': 'Đang lưu...',
    'info.role_save_btn': 'Lưu vai trò',
    'info.role_error': 'Không thể thay đổi vai trò',
    'info.transfer_error': 'Lỗi khi chuyển quyền sở hữu nhóm',
    'info.group_name_updated': 'Đã cập nhật tên nhóm thành công',
    'info.group_name_error': 'Lỗi khi cập nhật tên nhóm',
    'info.group_avatar_updated': 'Đã cập nhật ảnh đại diện nhóm',
    'info.group_avatar_error': 'Lỗi khi cập nhật ảnh đại diện nhóm',
    'info.view_profile': 'Xem trang cá nhân',
    'info.you': 'Bạn',

    // Chat Inputs & Actions
    'input.placeholder_user': 'Nhập tin nhắn để trò chuyện...',
    'input.placeholder_bot': 'Hỏi trợ lý AI bất kỳ điều gì...',
    'input.send': 'Gửi',
    'input.voice_message': 'Tin nhắn thoại',
    'input.more_options': 'Thêm tùy chọn',
    'input.emoji': 'Biểu cảm',
    'input.sticker': 'Nhãn dán',
    'input.gif': 'Ảnh GIF',
    'input.attach_file': 'Đính kèm tệp',
    'input.send_location': 'Gửi vị trí',
    'input.send_current_location': 'Gửi vị trí hiện tại',
    'input.share_live_location': 'Chia sẻ vị trí trực tiếp',
    'input.stop_live_location': 'Dừng chia sẻ vị trí',
    'input.live_location_active': 'Đang chia sẻ vị trí trực tiếp',
    'input.live_location_desc': 'Thành viên nhóm có thể thấy vị trí của bạn trong thời gian thực.',
    'input.create_poll': 'Tạo bình chọn',
    'input.create_reminder': 'Tạo nhắc hẹn',
    'input.send_contact_card': 'Gửi danh thiếp',
    'input.quick_like': 'Thích nhanh',
    'input.stop_recording': 'Dừng ghi âm',
    'input.recording_failed': 'Không thể ghi âm',
    'input.recording_unsupported': 'Trình duyệt không hỗ trợ ghi âm',
    'input.microphone_permission_needed': 'Vui lòng cấp quyền truy cập microphone trong cài đặt trình duyệt.',
    'input.file_too_large': 'Tệp quá lớn',
    'input.over_limit': 'Vượt quá giới hạn tệp',
    'input.limit_files_desc': 'Bạn chỉ có thể gửi tối đa 10 tệp cùng một lúc.',
    'input.oversized_files_desc': 'Một số tệp của bạn vượt quá giới hạn 50MB và sẽ bị bỏ qua.',
    'input.upload_failed': 'Tải tệp lên thất bại',
    'input.send_failed': 'Gửi tin nhắn thất bại',
    'input.send_image': 'Gửi hình ảnh',
    'input.location_unsupported': 'Trình duyệt không hỗ trợ định vị vị trí',
    'input.location_permission_needed': 'Quyền truy cập vị trí bị từ chối',
    'input.location_failed': 'Không thể xác định vị trí',
    'input.voice_send_failed': 'Không thể gửi tin nhắn thoại',
    'input.unsupported': 'Không hỗ trợ định dạng này',
    'input.hd_only_with_images': 'Chỉ hoạt động đối với hình ảnh',
    'input.hd_tooltip': 'Gửi ảnh chất lượng gốc',

    // Chat Window & Welcome Area
    'chat.welcome': 'Chào mừng bạn đến với UniChat!',
    'chat.welcome_desc': 'Chọn một cuộc trò chuyện từ danh sách bên trái hoặc bắt đầu cuộc trò chuyện mới để liên lạc với giáo viên hoặc bạn học của bạn.',
    'chat.fav_msg': 'Tin nhắn yêu thích',
    'chat.fav_msg_desc': 'Lưu trữ các tin nhắn và tài liệu quan trọng để xem lại nhanh chóng bất cứ lúc nào.',
    'chat.ext_features': 'Tính năng mở rộng',
    'chat.ext_features_desc': 'Tận dụng các tính năng cao cấp như Gọi video nhóm, Trợ lý AI và Tạo cuộc thăm dò ý kiến để học tập tốt hơn.',
    'chat.scroll_to_bottom': 'Cuộn xuống dưới cùng',
    'chat.back_to_latest': 'Quay lại tin nhắn mới nhất',
    'chat.back_to_latest_desc': 'Nhấp để cuộn nhanh đến các tin nhắn mới nhất',
    'chat.typing': 'đang soạn tin nhắn...',
    'chat.empty': 'Không có tin nhắn nào trong cuộc trò chuyện này. Hãy gửi lời chào đầu tiên!',

    // Poll System
    'poll.create_title': 'Tạo cuộc bình chọn mới',
    'poll.topic_label': 'Chủ đề bình chọn',
    'poll.topic_placeholder': 'Nhập chủ đề cuộc bình chọn...',
    'poll.topic_required': 'Chủ đề bình chọn là bắt buộc',
    'poll.options_label': 'Các phương án',
    'poll.option_placeholder': 'Nhập phương án {index}...',
    'poll.add_option': 'Thêm phương án',
    'poll.remove_option': 'Xóa',
    'poll.min_options': 'Cuộc bình chọn cần ít nhất 2 phương án',
    'poll.sending': 'Đang tạo bình chọn...',

    // Reminders
    'reminder.create_title': 'Tạo nhắc hẹn mới',
    'reminder.content_label': 'Nội dung nhắc hẹn',
    'reminder.content_placeholder': 'Nhập nội dung nhắc hẹn...',
    'reminder.content_required': 'Nội dung nhắc hẹn là bắt buộc',
    'reminder.date_label': 'Ngày hẹn',
    'reminder.time_label': 'Giờ hẹn',
    'reminder.repeat_label': 'Lặp lại',
    'reminder.repeat_none': 'Không lặp lại',
    'reminder.repeat_daily': 'Mỗi ngày',
    'reminder.repeat_weekly': 'Mỗi tuần',
    'reminder.repeat_monthly': 'Mỗi tháng',
    'reminder.morning_time': 'Buổi sáng (09:00)',
    'reminder.afternoon_time': 'Buổi chiều (14:00)',
    'reminder.evening_time': 'Buổi tối (20:00)',
    'reminder.future_date_required': 'Thời gian nhắc hẹn phải ở tương lai',

    // Chat Tags
    'tags.manage': 'Quản lý thẻ phân loại',
    'tags.new': 'Tạo thẻ phân loại mới',
    'tags.color': 'Màu sắc thẻ',
    'tags.name': 'Tên thẻ',
    'tags.name_placeholder': 'Nhập tên thẻ phân loại...',
    'tags.add': 'Thêm thẻ mới',
    'tags.save': 'Lưu lại',
    'tags.close': 'Đóng',
    'tags.confirm_delete': 'Bạn có chắc chắn muốn xóa thẻ phân loại này?',
    'tags.local_note': 'Ghi chú: Thẻ phân loại được lưu cục bộ trên trình duyệt này.',

    // Profile Page
    'profile.default_user': 'Người dùng',
    'profile.save_success_title': 'Thành công',
    'profile.save_success_text': 'Cập nhật thông tin cá nhân thành công',
    'profile.save_error_title': 'Lỗi',
    'profile.avatar_upload_error': 'Lỗi tải ảnh đại diện',
    'profile.cover_upload_error': 'Lỗi tải ảnh bìa',
    'profile.friend_request_sent_title': 'Đã gửi yêu cầu kết bạn',
    'profile.friend_request_sent_text': 'Yêu cầu kết bạn đã được gửi đến {name}',
    'profile.friend_request_error': 'Lỗi gửi yêu cầu kết bạn',
    'profile.friend_accept_success': 'Đã kết bạn với {name}',
    'profile.friend_accept_error': 'Lỗi đồng ý kết bạn',
    'profile.notice': 'Thông báo',
    'profile.call_developing': 'Tính năng gọi điện đang được phát triển',
    'profile.title': 'Trang cá nhân',
    'profile.not_found': 'Không tìm thấy',
    'profile.not_found_detail': 'Không tìm thấy người dùng này trong hệ thống.',
    'profile.update_info': 'Cập nhật thông tin',
    'profile.display_name': 'Tên hiển thị',
    'profile.display_name_placeholder': 'Nhập tên hiển thị...',
    'profile.gender': 'Giới tính',
    'profile.male': 'Nam',
    'profile.female': 'Nữ',
    'profile.birthdate': 'Ngày sinh',
    'profile.day_placeholder': 'Ngày',
    'profile.month_placeholder': 'Tháng',
    'profile.year_placeholder': 'Năm',
    'profile.phone': 'Số điện thoại',
    'profile.address': 'Địa chỉ',
    'profile.bio': 'Giới thiệu bản thân',
    'profile.change_cover': 'Đổi ảnh bìa',
    'profile.message': 'Nhắn tin',
    'profile.call': 'Gọi điện',
    'profile.add_friend': 'Kết bạn',
    'profile.accept_friend': 'Đồng ý kết bạn',
    'profile.request_sent': 'Đã gửi yêu cầu',
    'profile.friends': 'Bạn bè',
    'profile.edit': 'Chỉnh sửa',
    'profile.personal_info': 'Thông tin cá nhân',
    'profile.not_updated': 'Chưa cập nhật',
    'profile.phone_privacy_note': 'Số điện thoại của bạn sẽ chỉ hiển thị với bạn bè.',
    'profile.update': 'Cập nhật',

    // Group Conversations
    'group.join_not_found': 'Không tìm thấy cuộc trò chuyện để tham gia',
    'group.join_success': 'Đã tham gia nhóm thành công',
    'group.join_error': 'Lỗi khi tham gia nhóm',
    'group.self_add_error': 'Bạn không thể tự thêm chính mình',
    'group.user_not_found': 'Không tìm thấy người dùng',
    'group.min_members': 'Nhóm cần ít nhất 2 thành viên khác',
    'group.name_required': 'Tên nhóm là bắt buộc',
    'group.create_success': 'Đã tạo nhóm thành công',
    'group.create_error': 'Lỗi khi tạo nhóm',
    'group.failure': 'Thất bại',
    'group.create_title': 'Tạo nhóm mới',
    'group.name_label': 'Tên nhóm',
    'group.name_placeholder': 'Nhập tên nhóm...',
    'group.add_members_friends': 'Thêm thành viên từ danh sách bạn bè',
    'group.search_placeholder': 'Tìm kiếm theo tên, email hoặc số điện thoại...',
    'group.search_results': 'Kết quả tìm kiếm',
    'group.not_friend_cannot_add': 'Chưa là bạn bè (Không thể tự động thêm)',
    'group.no_friends_found': 'Không tìm thấy bạn bè phù hợp',
    'group.selected_count': 'Đã chọn {count}',
    'group.create_button': 'Tạo nhóm',
    'group.already_in_group': 'Người dùng này đã ở trong nhóm',
    'group.select_one_member': 'Vui lòng chọn ít nhất một thành viên',
    'group.add_members_success': 'Đã thêm thành viên thành công',
    'group.add_members_error': 'Lỗi khi thêm thành viên',
    'group.add_members': 'Thêm thành viên',
    'group.not_friend': 'Chưa kết bạn',
    'group.all_friends_in_group': 'Tất cả bạn bè đã có mặt trong nhóm',

    // Navigation Sidebar
    'sidebar.chat': 'Tin nhắn',
    'sidebar.contacts': 'Danh bạ',
    'sidebar.notifications': 'Thông báo',
    'sidebar.profile': 'Cá nhân',
    'sidebar.settings': 'Cài đặt',
    'sidebar.general_settings': 'Cài đặt chung',
    'sidebar.logout': 'Đăng xuất',
    'sidebar.bot': 'AI Trợ lý',

    // Active Sessions & Revoke Device
    'sessions.logged_out': 'Đã đăng xuất',
    'sessions.logout': 'Đăng xuất',
    'sessions.logout_all': 'Đăng xuất tất cả các thiết bị',
    'sessions.logout_all_text': 'Hành động này sẽ đăng xuất tài khoản của bạn khỏi tất cả các thiết bị khác ngoài trình duyệt hiện tại. Tiếp tục?',
    'sessions.logout_all_title': 'Đăng xuất mọi thiết bị',
    'sessions.logout_text': 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản của mình?',
    'sessions.logout_that_device': 'Đăng xuất thiết bị này',
    'sessions.logout_title': 'Đăng xuất',
    'sessions.revoke_device': 'Đăng xuất thiết bị này',
    'sessions.revoke_device_text': 'Xác nhận đăng xuất tài khoản khỏi thiết bị này?',
    'sessions.revoke_error': 'Không thể đăng xuất thiết bị',
    'sessions.revoke_success': 'Thiết bị đã được đăng xuất thành công',
    'sessions.revoke_text': 'Bạn có muốn đăng xuất tài khoản của mình khỏi thiết bị được chọn?',
    'sessions.revoke_title': 'Đăng xuất thiết bị',
    'sessions.this_is_me': 'Thiết bị hiện tại của bạn',

    // Security Notifications Page
    'notif_page.clear_all': 'Xóa tất cả',
    'notif_page.cloud_pending': 'Đang xử lý...',
    'notif_page.empty': 'Không có thông báo nào.',
    'notif_page.empty_unread': 'Không có thông báo chưa đọc.',
    'notif_page.login_device': 'Đăng nhập thiết bị mới',
    'notif_page.mark_read': 'Đánh dấu đã đọc',
    'notif_page.pw_changed': 'Mật khẩu đã thay đổi',
    'notif_page.title': 'Thông báo bảo mật',
    'notif_page.unread': 'Chưa đọc',
  },
  en: {
    // Navigation
    'nav.back': 'Back',
    'nav.settings': 'Settings',
    'nav.experience': 'UniChat Experience',

    // Headers
    'header.title': 'Customize Application',
    'header.description': 'All changes will be saved locally on this browser and synced when you log in on other UniChat devices.',
    'header.search_messages': 'Search messages...',
    'header.view_profile': 'View profile',
    'header.members_count': '{count} members',
    'header.active': 'Active',
    'header.offline': 'Offline',
    'header.video_call_group': 'Group video call',
    'header.video_call_direct': 'Video call',
    'header.voice_call_group': 'Group voice call',
    'header.voice_call_direct': 'Voice call',
    'header.ongoing_call': 'Ongoing call ({count} participants)',
    'header.search_min_chars': 'Enter at least 2 characters to search messages',
    'header.searching': 'Searching...',
    'header.no_messages_found': 'No messages found containing "{query}"',
    'header.search_results': 'Search results ({count})',

    // Sections
    'section.account': 'Account & Security',
    'section.account_subtitle': 'Manage your devices and protection methods',
    'section.privacy': 'Privacy',
    'section.privacy_subtitle': 'Control what others see about you',
    'section.notifications': 'Notifications',
    'section.notifications_subtitle': 'Sound settings and message delivery',
    'section.media': 'Data & Media',
    'section.media_subtitle': 'Manage how the app handles files and storage',
    'section.theme': 'Appearance & Language',
    'section.theme_subtitle': 'Customize the appearance of the application',
    'section.account_management': 'Account Management',
    'section.account_management_subtitle': 'These actions cannot be undone. Please consider carefully before proceeding.',

    // Account & Security Section
    'account.devices': 'Login Devices',
    'account.devices_desc': 'You are currently logged in on {count} device(s).',
    'account.manage_sessions': 'Manage Sessions',
    'account.change_password': 'Change Password',
    'account.change_password_desc': 'Update your password regularly for maximum security.',

    // Privacy Section
    'privacy.online_status': 'Online Status',
    'privacy.online_status_desc': 'Allow friends to see when you are online.',
    'privacy.phone_search': 'Phone Number Search',
    'privacy.phone_search_desc': 'Allow strangers to find you through phone number.',
    'privacy.sync_contacts': 'Sync Contacts',
    'privacy.sync_contacts_desc': 'Automatically sync new contacts from your address book.',

    // Notifications Section
    'notif.push': 'Push Notifications',
    'notif.push_desc': 'Receive notifications immediately on your desktop screen.',
    'notif.sound': 'Notification Sound',
    'notif.sound_desc': 'Play a sound when you receive new messages or calls.',

    // Media Section
    'media.auto_download': 'Auto-Download Media',
    'media.auto_download_desc': 'Automatically save photos and videos to your browser cache.',

    // Theme & Language Section
    'theme.label': 'Theme',
    'theme.system': 'System',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'language.label': 'Application Language',
    'language.vi': 'Tiếng Việt',
    'language.en': 'English',

    // Chat Wallpaper Settings
    'info.change_wallpaper': 'Change Wallpaper',
    'wallpaper.modal_title': 'Change Wallpaper',
    'wallpaper.save': 'Save Changes',
    'wallpaper.cancel': 'Cancel',
    'wallpaper.study_meadow': 'Study Meadow',
    'wallpaper.math_orbit': 'Math Orbit',
    'wallpaper.library_horizon': 'Library Horizon',
    'wallpaper.science_lab': 'Science Lab',
    'wallpaper.world_classroom': 'World Classroom',

    // Account Management Section
    'account_mgmt.lock': 'Lock Account',
    'account_mgmt.lock_desc': 'Temporarily pause access. Account can be unlocked later.',
    'account_mgmt.delete': 'Delete Account',
    'account_mgmt.delete_desc': 'Permanently delete your account and all associated data.',

    // Footer
    'footer.version': 'UniChat v1.0.0 Alpha',
    'footer.note': 'Internal education system. Display settings only apply on this browser.',

    // Modals
    'modal.change_password': 'Change Password',
    'modal.verify_otp': 'Verify OTP',
    'modal.current_password': 'Current Password',
    'modal.new_password': 'New Password',
    'modal.confirm_password': 'Confirm New Password',
    'modal.send_otp': 'Send Verification Code',
    'modal.confirm': 'Confirm',
    'modal.back': 'Go Back',
    'modal.lock_account': 'Lock Account',
    'modal.delete_account': 'Delete Account',
    'modal.verify_password': 'Please verify your current password to continue.',
    'modal.otp_sent': 'Verification code has been sent to email: {email}',
    'modal.password_mismatch': 'Password confirmation does not match.',
    'modal.error': 'An error occurred, please try again.',
    'modal.invalid_otp': 'Verification code is incorrect.',

    // Auth events (used by AuthContext outside React tree)
    'auth.session_expired': 'Your session has expired. Please log in again.',
    'auth.friend_request_new': 'You have a new friend request!',
    'auth.friend_request_new_text': 'A user has sent you a friend request.',
    'auth.lock_success': 'Your account has been locked successfully.',
    'auth.delete_success': 'Your account has been permanently deleted.',

    // Call events
    'call.video_upgrade_declined': 'Video upgrade request was declined by the other party.',
    'call.screen_share_busy': 'Cannot share screen: the screen is in use by another process.',
    'call.screen_share_denied': 'Screen share permission denied. Please grant access in browser settings.',
    'call.incoming_group_call': 'Incoming group call',
    'call.group_invite_desc': 'You have an invitation to join a group video call',
    'call.default_group_name': 'Group call',
    'call.decline': 'Decline',
    'call.join': 'Join',

    // Inbox / Chat List
    'inbox.all': 'All',
    'inbox.unread': 'Unread',
    'inbox.classify': 'Classify',
    'inbox.mention_tag': '[@ Mentioned]',
    'inbox.by_status': 'By status',
    'inbox.by_tag': 'By tag',
    'inbox.no_tag': 'Untagged',
    'inbox.manage_tags': 'Manage tags',
    'inbox.empty': 'No conversations found',
    'inbox.search_placeholder': 'Search messages, contacts...',
    'inbox.hidden_chat': 'Hidden conversation',
    'inbox.hidden_warning_title': 'Hidden chat warning',
    'inbox.hidden_warning_text': 'This conversation is hidden. Enter PIN to search.',
    'inbox.hide_title': 'Hide conversation',
    'inbox.hide_text': 'Enter PIN to hide this conversation. You will need this PIN to access it again.',
    'inbox.pin_placeholder': 'Enter PIN',
    'inbox.hide_btn': 'Hide',
    'inbox.cancel': 'Cancel',
    'inbox.pin_invalid': 'PIN must be 4 digits',
    'inbox.hide_success': 'Conversation hidden successfully',
    'inbox.unlock_title': 'Unlock conversation',
    'inbox.unlock_text': 'Please enter PIN to show the conversation',
    'inbox.unlock_btn': 'Unlock',
    'inbox.pin_wrong': 'Incorrect PIN, please try again',
    'inbox.unlock_success': 'Unlocked successfully',
    'inbox.options': 'Options',
    'inbox.pin': 'Pin conversation',
    'inbox.unpin': 'Unpin conversation',
    'inbox.lock': 'Lock conversation',
    'inbox.unlock': 'Unlock',
    'inbox.call_video_out': 'Outgoing video call',
    'inbox.call_video_in': 'Incoming video call',
    'inbox.call_voice_out': 'Outgoing voice call',
    'inbox.call_voice_in': 'Incoming voice call',

    // Chat Sidebar Info
    'info.group_chat': 'Group Info',
    'info.direct_chat': 'Chat Info',
    'info.media': 'Photos & Videos',
    'info.files': 'Documents',
    'info.links': 'Links',
    'info.no_media': 'No photos or videos',
    'info.no_files': 'No documents',
    'info.no_links': 'No links',
    'info.view_all': 'View all',
    'info.pinned_messages': 'Pinned Messages ({count})',
    'info.recently_pinned': 'Recently pinned',
    'info.auto_delete_label': 'Auto-delete Messages',
    'info.never': 'Never',
    'info.day_1': '1 day',
    'info.days_7': '7 days',
    'info.days_30': '30 days',
    'info.unpin_conversation': 'Unpin Chat',
    'info.pin_conversation': 'Pin Chat',
    'info.delete_chat_history': 'Delete Chat History',
    'info.share_link_qr': 'Share Link & QR Code',
    'info.mute_notifications': 'Mute Notifications',
    'info.mute_for': 'Mute notifications for...',
    'info.mute_1_hour': '1 hour',
    'info.mute_4_hours': '4 hours',
    'info.mute_12_hours': '12 hours',
    'info.mute_until_8am': 'Until 8:00 AM tomorrow',
    'info.mute_permanent': 'Until turned back on',
    'info.mute_custom': 'Custom Schedule',
    'info.mute_custom_desc': 'Select a time range to auto-mute notifications daily',
    'info.mute_confirm_custom': 'Confirm Time Range',
    'info.mute_label_muted': 'Muted',
    'info.mute_status_muted': 'Notifications are muted',
    'info.mute_status_active': 'Notifications are active',
    'info.mute_from': 'From',
    'info.mute_to': 'To',
    'info.group_mgmt': 'Group Settings',
    'info.leave_group': 'Leave Group',
    'info.dissolve_group': 'Dissolve Group',
    'info.members_count': 'Members ({count})',
    'info.loading': 'Loading...',
    'info.group_fallback': 'Group Chat',
    'info.clear_title_one_side': 'Delete Chat on Your Side',
    'info.clear_text_one_side': 'Are you sure you want to delete chat history from your side? This action cannot be undone.',
    'info.delete_button': 'Delete Permanently',
    'info.clear_success': 'Chat history deleted successfully',
    'info.clear_error': 'Failed to delete chat history',
    'info.retry_later': 'Please try again later',
    'info.leave_error': 'Failed to leave group',
    'info.dissolve_title': 'Dissolve Group',
    'info.dissolve_text': 'Dissolving the group will permanently delete all members and messages. Are you sure you want to proceed?',
    'info.dissolve_button': 'Dissolve',
    'info.dissolve_error': 'Failed to dissolve group',
    'info.clear_history_title': 'Clear Group History',
    'info.delete_chat_everyone_text': 'Do you want to clear chat history only for yourself or for all group members?',
    'info.delete_chat_everyone_btn': 'Clear for everyone',
    'info.delete_chat_me_btn': 'Only for me',
    'info.success': 'Success',
    'info.history_error': 'Failed to clear history',
    'info.pin_error': 'Failed to pin conversation',
    'info.kick_title': 'Remove Member',
    'info.kick_text': 'Are you sure you want to remove {name} from this group?',
    'info.remove_button': 'Remove from Group',
    'info.remove_error': 'Failed to remove member',
    'info.change_role_title': 'Change Member Role',
    'info.role_member': 'Member',
    'info.role_deputy': 'Deputy',
    'info.role_owner': 'Leader',
    'info.owner': 'Leader',
    'info.deputy': 'Deputy',
    'info.member': 'Member',
    'info.saving': 'Saving...',
    'info.role_save_btn': 'Save Role',
    'info.role_error': 'Failed to change role',
    'info.transfer_error': 'Failed to transfer group ownership',
    'info.group_name_updated': 'Group name updated successfully',
    'info.group_name_error': 'Failed to update group name',
    'info.group_avatar_updated': 'Group avatar updated successfully',
    'info.group_avatar_error': 'Failed to update group avatar',
    'info.view_profile': 'View Profile',
    'info.you': 'You',

    // Chat Inputs & Actions
    'input.placeholder_user': 'Type a message to chat...',
    'input.placeholder_bot': 'Ask AI Assistant anything...',
    'input.send': 'Send',
    'input.voice_message': 'Voice Message',
    'input.more_options': 'More options',
    'input.emoji': 'Emojis',
    'input.sticker': 'Stickers',
    'input.gif': 'GIFs',
    'input.attach_file': 'Attach file',
    'input.send_location': 'Send location',
    'input.send_current_location': 'Send current location',
    'input.share_live_location': 'Share live location',
    'input.stop_live_location': 'Stop sharing location',
    'input.live_location_active': 'Sharing live location',
    'input.live_location_desc': 'Group members can see your location in real time.',
    'input.create_poll': 'Create poll',
    'input.create_reminder': 'Create reminder',
    'input.send_contact_card': 'Send contact card',
    'input.quick_like': 'Quick like',
    'input.stop_recording': 'Stop recording',
    'input.recording_failed': 'Recording failed',
    'input.recording_unsupported': 'Recording is not supported in this browser',
    'input.microphone_permission_needed': 'Please grant microphone access in browser settings.',
    'input.file_too_large': 'File too large',
    'input.over_limit': 'Files limit exceeded',
    'input.limit_files_desc': 'You can only send up to 10 files at a time.',
    'input.oversized_files_desc': 'Some files exceed the 50MB size limit and were skipped.',
    'input.upload_failed': 'Upload failed',
    'input.send_failed': 'Failed to send message',
    'input.send_image': 'Send image',
    'input.location_unsupported': 'Geolocation is not supported in this browser',
    'input.location_permission_needed': 'Location permission denied',
    'input.location_failed': 'Failed to get location',
    'input.voice_send_failed': 'Failed to send voice message',
    'input.unsupported': 'Format not supported',
    'input.hd_only_with_images': 'Only works for image files',
    'input.hd_tooltip': 'Send original high-quality image',

    // Chat Window & Welcome Area
    'chat.welcome': 'Welcome to UniChat!',
    'chat.welcome_desc': 'Select a conversation from the sidebar or start a new one to communicate with your teachers and classmates.',
    'chat.fav_msg': 'Favorite Messages',
    'chat.fav_msg_desc': 'Store important messages and documents to quickly review them at any time.',
    'chat.ext_features': 'Extended Features',
    'chat.ext_features_desc': 'Take advantage of premium features like Group Video Call, AI Assistant, and Poll Creation to enhance learning.',
    'chat.scroll_to_bottom': 'Scroll to bottom',
    'chat.back_to_latest': 'Back to latest messages',
    'chat.back_to_latest_desc': 'Click to jump to the newest messages',
    'chat.typing': 'is typing...',
    'chat.empty': 'No messages in this chat. Say hello to start the conversation!',

    // Poll System
    'poll.create_title': 'Create a New Poll',
    'poll.topic_label': 'Poll Topic',
    'poll.topic_placeholder': 'Enter poll topic...',
    'poll.topic_required': 'Poll topic is required',
    'poll.options_label': 'Options',
    'poll.option_placeholder': 'Enter option {index}...',
    'poll.add_option': 'Add option',
    'poll.remove_option': 'Remove',
    'poll.min_options': 'A poll needs at least 2 options',
    'poll.sending': 'Creating poll...',

    // Reminders
    'reminder.create_title': 'Create a New Reminder',
    'reminder.content_label': 'Reminder Content',
    'reminder.content_placeholder': 'Enter reminder content...',
    'reminder.content_required': 'Reminder content is required',
    'reminder.date_label': 'Date',
    'reminder.time_label': 'Time',
    'reminder.repeat_label': 'Repeat',
    'reminder.repeat_none': 'No repeat',
    'reminder.repeat_daily': 'Daily',
    'reminder.repeat_weekly': 'Weekly',
    'reminder.repeat_monthly': 'Monthly',
    'reminder.morning_time': 'Morning (09:00)',
    'reminder.afternoon_time': 'Afternoon (14:00)',
    'reminder.evening_time': 'Evening (20:00)',
    'reminder.future_date_required': 'Reminder time must be in the future',

    // Chat Tags
    'tags.manage': 'Manage Chat Tags',
    'tags.new': 'Create New Tag',
    'tags.color': 'Tag Color',
    'tags.name': 'Tag Name',
    'tags.name_placeholder': 'Enter tag name...',
    'tags.add': 'Add new tag',
    'tags.save': 'Save',
    'tags.close': 'Close',
    'tags.confirm_delete': 'Are you sure you want to delete this tag?',
    'tags.local_note': 'Note: Chat tags are saved locally on this browser.',

    // Profile Page
    'profile.default_user': 'User',
    'profile.save_success_title': 'Success',
    'profile.save_success_text': 'Personal profile updated successfully',
    'profile.save_error_title': 'Error',
    'profile.avatar_upload_error': 'Failed to upload avatar',
    'profile.cover_upload_error': 'Failed to upload cover',
    'profile.friend_request_sent_title': 'Friend request sent',
    'profile.friend_request_sent_text': 'Friend request has been sent to {name}',
    'profile.friend_request_error': 'Failed to send friend request',
    'profile.friend_accept_success': 'Now friends with {name}',
    'profile.friend_accept_error': 'Failed to accept friend request',
    'profile.notice': 'Notice',
    'profile.call_developing': 'Calling feature is under development',
    'profile.title': 'Profile',
    'profile.not_found': 'Not Found',
    'profile.not_found_detail': 'User not found in the system.',
    'profile.update_info': 'Update Profile',
    'profile.display_name': 'Display Name',
    'profile.display_name_placeholder': 'Enter display name...',
    'profile.gender': 'Gender',
    'profile.male': 'Male',
    'profile.female': 'Female',
    'profile.birthdate': 'Date of Birth',
    'profile.day_placeholder': 'DD',
    'profile.month_placeholder': 'MM',
    'profile.year_placeholder': 'YYYY',
    'profile.phone': 'Phone Number',
    'profile.address': 'Address',
    'profile.bio': 'Bio',
    'profile.change_cover': 'Change Cover',
    'profile.message': 'Message',
    'profile.call': 'Call',
    'profile.add_friend': 'Add Friend',
    'profile.accept_friend': 'Accept Request',
    'profile.request_sent': 'Request Sent',
    'profile.friends': 'Friends',
    'profile.edit': 'Edit Profile',
    'profile.personal_info': 'Personal Information',
    'profile.not_updated': 'Not updated',
    'profile.phone_privacy_note': 'Your phone number will only be visible to friends.',
    'profile.update': 'Update',

    // Group Conversations
    'group.join_not_found': 'Conversation not found to join',
    'group.join_success': 'Successfully joined group',
    'group.join_error': 'Failed to join group',
    'group.self_add_error': 'You cannot add yourself',
    'group.user_not_found': 'User not found',
    'group.min_members': 'Group needs at least 2 other members',
    'group.name_required': 'Group name is required',
    'group.create_success': 'Group created successfully',
    'group.create_error': 'Failed to create group',
    'group.failure': 'Failure',
    'group.create_title': 'Create New Group',
    'group.name_label': 'Group Name',
    'group.name_placeholder': 'Enter group name...',
    'group.add_members_friends': 'Add members from friends list',
    'group.search_placeholder': 'Search by name, email or phone number...',
    'group.search_results': 'Search Results',
    'group.not_friend_cannot_add': 'Not friends (Cannot automatically add)',
    'group.no_friends_found': 'No matching friends found',
    'group.selected_count': 'Selected {count}',
    'group.create_button': 'Create Group',
    'group.already_in_group': 'This user is already in the group',
    'group.select_one_member': 'Please select at least one member',
    'group.add_members_success': 'Successfully added members',
    'group.add_members_error': 'Failed to add members',
    'group.add_members': 'Add Members',
    'group.not_friend': 'Not friends',
    'group.all_friends_in_group': 'All friends are already in this group',

    // Contacts Section
    'contacts.title': 'Contacts',
    'contacts.description': 'Manage your contacts',
    'contacts.groups': 'Groups',
    'contacts.requests': 'Friend requests',
    'contacts.invitations': 'Sent invitations',
    'contacts.search_placeholder': 'Search friends...',
    'contacts.sort_name': 'Sort by name',
    'contacts.filter': 'Filter',
    'contacts.filter_all': 'All',
    'contacts.filter_nickname': 'With nickname',
    'contacts.filter_no_nickname': 'No nickname',
    'contacts.filter_blocked': 'Blocked',
    'contacts.loading': 'Loading...',
    'contacts.empty': 'No contacts found.',

    // Additional Missing Keys (En)
    'call.join_group_error': 'Error joining group call.',
    'info.change_avatar': 'Change avatar',
    'info.ai_assistant': 'AI Assistant',
    'info.archive': 'Archive',
    'info.sender': 'Sender',
    'info.select_date': 'Select date',
    'info.change_role_btn_title': 'Change role',
    'info.kick_btn_title': 'Remove from group',
    'info.appoint_owner_title': 'Appoint group owner',
    'info.appoint_owner_desc': 'Are you sure you want to transfer ownership to this member?',
    'info.no_candidates': 'No candidates',
    'info.appoint_leave_btn': 'Appoint & Leave',
    'info.auto_delete_title': 'Auto-delete messages',
    'profile_completion.invalid_phone': 'Invalid phone number',
    'profile_completion.otp_sent_title': 'OTP sent',
    'profile_completion.otp_sent_text': 'OTP has been sent to your email.',
    'profile_completion.otp_send_error': 'Error sending OTP',
    'profile_completion.required_info': 'Please fill all required information',
    'profile_completion.invalid_birthdate': 'Invalid birthdate',
    'profile_completion.welcome_title': 'Welcome',
    'profile_completion.complete_success': 'Profile completed successfully',
    'profile_completion.complete_error': 'Error completing profile',
    'profile.image_updated': 'Avatar updated successfully',

    // Navigation Sidebar
    'sidebar.chat': 'Messages',
    'sidebar.contacts': 'Contacts',
    'sidebar.notifications': 'Notifications',
    'sidebar.profile': 'Profile',
    'sidebar.settings': 'Settings',
    'sidebar.general_settings': 'General Settings',
    'sidebar.logout': 'Log Out',
    'sidebar.bot': 'AI Assistant',

    // Active Sessions & Revoke Device
    'sessions.logged_out': 'Logged out',
    'sessions.logout': 'Log Out',
    'sessions.logout_all': 'Log Out All Other Devices',
    'sessions.logout_all_text': 'This will log you out from all other devices except this browser. Proceed?',
    'sessions.logout_all_title': 'Log Out Everywhere',
    'sessions.logout_text': 'Are you sure you want to log out from your account?',
    'sessions.logout_that_device': 'Log out of this device',
    'sessions.logout_title': 'Log Out',
    'sessions.revoke_device': 'Log out of this device',
    'sessions.revoke_device_text': 'Confirm log out from this device?',
    'sessions.revoke_error': 'Failed to revoke session',
    'sessions.revoke_success': 'Session revoked successfully',
    'sessions.revoke_text': 'Do you want to log out of your account from the selected device?',
    'sessions.revoke_title': 'Revoke Session',
    'sessions.this_is_me': 'This is your current device',

    // Security Notifications Page
    'notif_page.clear_all': 'Clear All',
    'notif_page.cloud_pending': 'Pending...',
    'notif_page.empty': 'No notifications.',
    'notif_page.empty_unread': 'No unread notifications.',
    'notif_page.login_device': 'New device login detected',
    'notif_page.mark_read': 'Mark all as read',
    'notif_page.pw_changed': 'Password changed successfully',
    'notif_page.title': 'Security Notifications',
    'notif_page.unread': 'Unread Only',
  },
};

/**
 * Standalone translation helper — usable OUTSIDE the React component tree
 * (e.g. in AuthContext socket event handlers or plain utility functions).
 * Reads the persisted language from localStorage so it stays in sync with
 * the language the user selected on the Settings page.
 */
export const translateKey = (
  key: string,
  params?: Record<string, string | number>,
): string => {
  let lang: Language = 'vi';
  try {
    const saved = localStorage.getItem('app_language') as Language | null;
    if (saved && (saved === 'vi' || saved === 'en')) lang = saved;
  } catch {
    // localStorage not available (SSR / test env)
  }
  let text = translations[lang][key] || key;
  if (params) {
    Object.keys(params).forEach((param) => {
      text = text.replace(`{${param}}`, String(params[param]));
    });
  }
  return text;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'light';
    } catch {
      return 'light';
    }
  });

  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return (localStorage.getItem(LANGUAGE_KEY) as Language) || 'vi';
    } catch {
      return 'vi';
    }
  });

  const [isDark, setIsDark] = useState(false);

  // Determine if dark mode should be applied
  useEffect(() => {
    const updateTheme = () => {
      let shouldBeDark = false;

      if (themeMode === 'dark') {
        shouldBeDark = true;
      } else if (themeMode === 'light') {
        shouldBeDark = false;
      } else {
        // system mode: check system preference
        shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      setIsDark(shouldBeDark);

      // Apply theme to document
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    };

    updateTheme();

    // Listen for system theme changes in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [themeMode]);

  // Apply language to document
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      console.error('Failed to save theme preference');
    }
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch {
      console.error('Failed to save language preference');
    }
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || key;
    
    // Replace parameters like {count}, {email}, etc.
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(`{${param}}`, String(params[param]));
      });
    }
    
    return text;
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark, language, setLanguage, t }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
