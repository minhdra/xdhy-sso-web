// Bảng ở mục Quản lý cuộn trong khung (tiêu đề cố định) thay vì kéo dài cả trang:
// chiều cao = màn hình trừ phần đầu trang + thanh lọc + phân trang (~600px), tối thiểu 240px.
// `extra`: phần cao thêm phía trên bảng ở panel có nhiều thẻ/bộ lọc hơn bình thường.
export const tableScrollY = (extra = 0) => `max(240px, calc(100vh - ${600 + extra}px))`;
export const TABLE_SCROLL_Y = tableScrollY();
