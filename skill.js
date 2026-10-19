// kakao-skill-hi4labs: 카카오 i 오픈빌더 스킬 서버
// 봇 시스템 → Worker → AI 분류 + FAQ 매핑 → JSON 응답

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body || {};
    const utterance = payload?.userRequest?.utterance || '';
    const userId = payload?.userRequest?.user?.id || 'anonymous';

    const intent = classifyIntent(utterance);
    const faq = matchFAQ(utterance, intent);

    let answer = faq.answer;
    if (faq.needsHuman) {
      await notifyHuman({ userId, utterance, intent }, process.env);
      answer += '\n\n담당자가 확인 후 답변드릴게요. 잠시만 기다려 주세요.';
    }

    return res.status(200).json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: answer } }]
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function classifyIntent(utterance) {
  const u = utterance.toLowerCase();
  if (/qmr|omr|채점|스캔|답안지/.test(u)) return { service: 'QMR', intent: 'feature' };
  if (/deskq|학원|알림|문자|발송|학생/.test(u)) return { service: 'deskQ', intent: 'feature' };
  if (/testq|시험지|문항|출제/.test(u)) return { service: 'testQ', intent: 'feature' };
  if (/unifinder|대학|입시|전형|모집/.test(u)) return { service: 'Unifinder', intent: 'feature' };
  if (/결제|요금|충전|크레딧|환불/.test(u)) return { service: 'common', intent: 'payment' };
  if (/계정|로그인|비밀번호|가입|인증/.test(u)) return { service: 'common', intent: 'account' };
  if (/에러|오류|안됨|실패|버그/.test(u)) return { service: 'common', intent: 'error' };
  if (/안녕|hello|hi/.test(u)) return { service: 'common', intent: 'greeting' };
  return { service: 'unknown', intent: 'inquiry' };
}

const FAQ = [
  {
    intent: { service: 'QMR', intent: 'feature' },
    keywords: ['채점', '스캔', 'omr'],
    answer: 'QMR 채점은 A4 프린터로 인쇄한 답안지를 스마트폰 카메라로 촬영하면 100장 3분 내 자동 채점됩니다. 자세한 사용법: https://qmr.kr/help/',
    needsHuman: false
  },
  {
    intent: { service: 'deskQ', intent: 'feature' },
    keywords: ['문자', '발송', '학부모', '알림'],
    answer: 'deskQ에서 알림톡 발송은 학생 페이지에서 발송안 작성 후 선생님 확인을 거쳐 전송됩니다. 자세한 사용법: https://deskq.kr/help/',
    needsHuman: false
  },
  {
    intent: { service: 'common', intent: 'payment' },
    keywords: ['요금', '결제', '충전'],
    answer: '요금제/충전 관련은 help@hi4labs.com 으로 문의 주시면 답변드릴게요.',
    needsHuman: true
  },
  {
    intent: { service: 'common', intent: 'greeting' },
    keywords: [],
    answer: '안녕하세요! Hi4Labs 자동응답입니다. QMR, testQ, deskQ, Unifinder 관련 질문을 주시면 답변드릴게요.',
    needsHuman: false
  },
  {
    intent: { service: 'unknown', intent: 'inquiry' },
    keywords: [],
    answer: 'Hi4Labs 자동응답입니다. deskQ, QMR, testQ.ai, Unifinder 관련 질문을 주시면 답변드릴게요. 자세한 문의는 help@hi4labs.com 으로 주세요.',
    needsHuman: false
  }
];

function matchFAQ(utterance, intent) {
  for (const faq of FAQ) {
    if (faq.intent.service !== intent.service) continue;
    if (faq.intent.intent !== intent.intent) continue;
    if (faq.keywords.length === 0) return faq;
    if (faq.keywords.some(kw => utterance.toLowerCase().includes(kw))) return faq;
  }
  return FAQ[FAQ.length - 1];
}

async function notifyHuman(payload, env) {
  console.log('human handoff:', payload);
}
