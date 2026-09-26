import { MinusCircleOutlined, PlusOutlined, UndoOutlined, UploadOutlined } from '@ant-design/icons';
import {
  App as AntdApp,
  Button,
  Col,
  ColorPicker,
  Form,
  Input,
  Popconfirm,
  Row,
  Skeleton,
  Space,
  Tooltip,
  Upload,
} from 'antd';
import { useEffect, useState } from 'react';

import {
  type Branding,
  type BrandingImageKind,
  type BrandingText,
  getBranding,
  resetBrandingImage,
  updateBranding,
  uploadBrandingImage,
} from '../../api';
import { DEFAULT_LOGO, footerText, useBrandingStore } from '../../store/branding';
import { RULES_FORM } from '../../validator';

const IMAGES: { kind: BrandingImageKind; label: string; hint: string; accept: string; box: number }[] = [
  { kind: 'logo_light', label: 'Logo (nền sáng)', hint: 'PNG/JPG/WEBP · ≤2MB · nên nền trong suốt, cao ~80px', accept: '.png,.jpg,.jpeg,.webp', box: 56 },
  { kind: 'logo_dark', label: 'Logo (nền tối)', hint: 'Để trống = dùng logo nền sáng', accept: '.png,.jpg,.jpeg,.webp', box: 56 },
  { kind: 'favicon', label: 'Favicon', hint: 'PNG/ICO vuông 32–180px · ≤512KB', accept: '.png,.ico', box: 40 },
  { kind: 'login_background', label: 'Ảnh nền trang đăng nhập', hint: 'JPG/WEBP ngang ~1600px · ≤5MB · để trống = hoạt hình mặc định', accept: '.png,.jpg,.jpeg,.webp', box: 56 },
];

// Thông tin thương hiệu SSO (26/09/2026) - mỗi công ty (1 triển khai riêng) tự
// đổi tên, logo, màu, footer mà không phải sửa code. Chỉ admin; đọc công khai
// qua GET /branding (trang đăng nhập dùng).
export default function BrandingAdminPanel() {
  const { notification } = AntdApp.useApp();
  const setStore = useBrandingStore((s) => s.set);
  const [form] = Form.useForm<BrandingText>();
  const [data, setData] = useState<Branding | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyKind, setBusyKind] = useState<BrandingImageKind | null>(null);
  const values = Form.useWatch([], form) as Partial<BrandingText> | undefined;

  useEffect(() => {
    void (async () => {
      const res = await getBranding();
      if (res.ok) {
        setData(res.data);
        form.setFieldsValue(res.data);
      }
    })();
  }, [form]);

  const handleSave = async (v: BrandingText) => {
    setSaving(true);
    try {
      const color = typeof v.primary_color === 'string' ? v.primary_color : (v.primary_color as { toHexString: () => string }).toHexString();
      const payload = { ...v, primary_color: color, footer_links: v.footer_links ?? [] };
      const res = await updateBranding(payload);
      if (!res.ok) {
        notification.error({ message: res.data.message || 'Không lưu được.' });
        return;
      }
      const next = { ...(data as Branding), ...payload };
      setData(next);
      setStore(next);
      notification.success({ message: 'Đã lưu thông tin tổ chức.' });
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setSaving(false);
    }
  };

  const changeImage = async (kind: BrandingImageKind, file: File | null) => {
    setBusyKind(kind);
    try {
      const res = file ? await uploadBrandingImage(kind, file) : await resetBrandingImage(kind);
      if (!res.ok) {
        notification.error({ message: (res.data as { message?: string }).message || 'Không lưu được ảnh.' });
        return;
      }
      const url = file ? (res.data as unknown as { url: string }).url : null;
      const next = { ...(data as Branding), [kind]: url };
      setData(next);
      setStore(next);
      notification.success({ message: file ? 'Đã cập nhật ảnh.' : 'Đã về ảnh mặc định.' });
    } catch {
      notification.error({ message: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setBusyKind(null);
    }
  };

  if (!data) return <Skeleton active paragraph={{ rows: 8 }} />;

  const previewColor =
    typeof values?.primary_color === 'string'
      ? values.primary_color
      : (values?.primary_color as { toHexString?: () => string } | undefined)?.toHexString?.() ?? data.primary_color;

  return (
    <div className="ssoPanel ssoAppsAdmin">
      <div className="ssoPanel-headRow">
        <div>
          <h2>Thương hiệu</h2>
          <p className="ssoPanel-hint">
            Tên, logo, màu và chân trang của cổng đăng nhập. Đổi xong áp dụng ngay cho mọi người (tối đa 1 phút).
          </p>
        </div>
      </div>

      {/* Xem trước header + chân trang */}
      <div className="ssoBrand-preview" style={{ borderColor: previewColor }}>
        <div className="ssoBrand-previewBar" style={{ background: previewColor }} />
        <Space size={12} align="center">
          <img src={data.logo_light || DEFAULT_LOGO} alt="" height={32} />
          <strong>{values?.app_name || data.app_name}</strong>
          <span className="ssoPanel-hint" style={{ margin: 0 }}>
            {values?.org_name || data.org_name}
          </span>
        </Space>
        <div className="ssoPanel-hint">
          {footerText({ ...data, footer_text: values?.footer_text ?? data.footer_text })}
        </div>
      </div>

      <h3 className="ssoPanel-subhead">Hình ảnh</h3>
      <Row gutter={[16, 16]}>
        {IMAGES.map((img) => {
          const url = data[img.kind];
          return (
            <Col key={img.kind} xs={24} md={12}>
              <div className="ssoBrand-image">
                <div
                  className={`ssoBrand-imageBox${img.kind === 'logo_dark' ? ' is-dark' : ''}`}
                  style={{ height: img.box + 16 }}
                >
                  {url || img.kind === 'logo_light' ? (
                    <img src={url || DEFAULT_LOGO} alt="" style={{ maxHeight: img.box }} />
                  ) : (
                    <span className="ssoPanel-hint" style={{ margin: 0 }}>
                      Mặc định
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>{img.label}</strong>
                  <div className="ssoPanel-hint" style={{ marginTop: 2 }}>
                    {img.hint}
                  </div>
                  <Space size={6} style={{ marginTop: 8 }} wrap>
                    <Upload
                      accept={img.accept}
                      showUploadList={false}
                      beforeUpload={(file) => {
                        void changeImage(img.kind, file);
                        return false;
                      }}
                    >
                      <Button size="small" icon={<UploadOutlined />} loading={busyKind === img.kind}>
                        Tải ảnh
                      </Button>
                    </Upload>
                    {url && (
                      <Popconfirm
                        title="Về ảnh mặc định?"
                        okText="Đồng ý"
                        cancelText="Huỷ"
                        onConfirm={() => changeImage(img.kind, null)}
                      >
                        <Button size="small" icon={<UndoOutlined />}>
                          Mặc định
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      <h3 className="ssoPanel-subhead">Thông tin</h3>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Row gutter={[16, 4]}>
          <Col xs={24} md={12}>
            <Form.Item name="org_name" label="Tên tổ chức" rules={[...RULES_FORM.required, { max: 150 }]} tooltip="Hiện ở tiêu đề tab trình duyệt và chân trang.">
              <Input placeholder="vd: Công ty CP Xây dựng ABC" />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="short_name" label="Tên viết tắt" rules={[...RULES_FORM.required, { max: 50 }]}>
              <Input placeholder="vd: ABC" />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="app_name" label="Tên ứng dụng" rules={[...RULES_FORM.required, { max: 100 }]}>
              <Input placeholder="vd: Tài khoản" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="tagline" label="Khẩu hiệu" tooltip="Hiện ở chân trang chủ.">
              <Input placeholder="vd: Một tài khoản cho mọi ứng dụng" maxLength={250} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="primary_color" label="Màu chủ đạo" rules={RULES_FORM.required}>
              <ColorPicker showText format="hex" disabledAlpha />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="login_heading" label="Tiêu đề trang đăng nhập" tooltip="Chữ lớn ở cột phải trang đăng nhập (màn rộng).">
              <Input placeholder="vd: Cổng truy cập chung của doanh nghiệp" maxLength={150} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="footer_text" label="Chân trang" tooltip="Dùng {year} để tự hiện năm hiện tại.">
              <Input placeholder="vd: © {year} Công ty ABC. All rights reserved." maxLength={250} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="login_description" label="Mô tả trang đăng nhập">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={500} placeholder="Đoạn giới thiệu ngắn dưới tiêu đề trang đăng nhập" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Liên kết chân trang" tooltip="Tối đa 8 link, hiện ở chân trang chủ (vd: Điều khoản, Chính sách bảo mật).">
              <Form.List name="footer_links">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {fields.map((field) => (
                      <Row key={field.key} gutter={8} wrap={false} align="top">
                        <Col flex="160px">
                          <Form.Item name={[field.name, 'label']} rules={RULES_FORM.required} style={{ marginBottom: 0 }}>
                            <Input placeholder="Tên link" maxLength={50} />
                          </Form.Item>
                        </Col>
                        <Col flex="auto">
                          <Form.Item
                            name={[field.name, 'url']}
                            rules={[...RULES_FORM.required, { pattern: /^(https?:\/\/|\/)/, message: 'Bắt đầu bằng http(s):// hoặc /' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="https://..." />
                          </Form.Item>
                        </Col>
                        <Col flex="none">
                          <Tooltip title="Xoá link">
                            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                          </Tooltip>
                        </Col>
                      </Row>
                    ))}
                    {fields.length < 8 && (
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ label: '', url: '' })}>
                        Thêm link
                      </Button>
                    )}
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </Col>
        </Row>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            Lưu thay đổi
          </Button>
          <Button icon={<UndoOutlined />} onClick={() => form.setFieldsValue(data)} disabled={saving}>
            Hoàn tác
          </Button>
        </Space>
      </Form>
    </div>
  );
}
