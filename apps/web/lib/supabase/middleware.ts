import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/verify',
  '/api/health',
  '/api/whoop/cron-sync',
  '/api/whoop/webhook',
  '/api/weekly-close',
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const publicPath = isPublicPath(pathname);

  if (!user && !publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/verify')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Mandatory onboarding gate. Si user existe y onboarding incompleto, redirige al paso
  // pendiente. /onboarding/* y /api/* quedan exentos para no romper el propio flujo.
  if (
    user &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/api/')
  ) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_status')
      .eq('id', user.id)
      .single();

    if (profile && profile.onboarding_status !== 'complete') {
      const { data: folder } = await supabase
        .from('athlete_folder')
        .select(
          'initialized_at, nutrition_onboarding_completed_at, training_onboarding_completed_at',
        )
        .eq('user_id', user.id)
        .single();

      let target = '/onboarding';
      if (folder?.initialized_at) {
        if (!folder.nutrition_onboarding_completed_at) {
          target = '/onboarding/nutrition';
        } else if (!folder.training_onboarding_completed_at) {
          target = '/onboarding/training';
        }
      }
      if (pathname !== target) {
        const url = request.nextUrl.clone();
        url.pathname = target;
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
