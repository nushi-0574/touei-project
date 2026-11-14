import { getAuthenticatedUser, getSupabaseAdmin } from '@/src/lib/server/billing';
import { getErrorMessage } from '@/src/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: 'ログインが必要です。' }, { status: 401 });

    const body = await request.json() as { productId?: string };
    if (!body.productId) {
      return Response.json({ error: '商品IDが指定されていません。' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabaseAdmin
      .from('digital_orders')
      .select('id, product_id, status')
      .eq('user_id', user.id)
      .eq('product_id', body.productId)
      .eq('status', 'completed')
      .maybeSingle();

    if (orderError || !order) {
      return Response.json({ error: '購入履歴が確認できないため、ダウンロードできません。' }, { status: 403 });
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('digital_products')
      .select('file_path, title')
      .eq('id', body.productId)
      .maybeSingle();

    if (productError || !product || !product.file_path) {
      return Response.json({ error: '対象の納品ファイルが見つかりません。' }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('digital-product-contents')
      .createSignedUrl(product.file_path, 60);

    if (signError || !signed?.signedUrl) {
      throw signError ?? new Error('署名付きURLの生成に失敗しました。');
    }

    return Response.json({ downloadUrl: signed.signedUrl, title: product.title });
  } catch (error) {
    console.error('Secure download URL generation failed:', error);
    return Response.json({ error: getErrorMessage(error, 'ダウンロードリンクを生成できませんでした。') }, { status: 500 });
  }
}
