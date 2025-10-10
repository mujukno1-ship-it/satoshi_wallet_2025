// js/targets-config.js
// ✅ 타점 규칙 “설정 전용” (여기만 고치면 무한 확장 가능)

export const TARGETS_CONFIG = {
  default: {
    lanes: [
      {
        name: "급등", when: (ctx)=> ctx.rate >= 0.05,
        buy:  { type: "none" },                           // 추격 금지
        take: { type: "ladder", steps: [0.03, 0.05, 0.08] },
        stop: { type: "single", k: -0.03 }
      },
      {
        name: "예열", when: (ctx)=> ctx.rate >= 0.02 && ctx.rate < 0.05,
        buy:  { type: "ladder", steps: [-0.005, -0.01, -0.015] },
        take: { type: "ladder", steps: [0.02, 0.03, 0.05] },
        stop: { type: "single", k: -0.02 }
      },
      {
        name: "하락", when: (ctx)=> ctx.rate <= -0.02,
        buy:  { type: "ladder", steps: [-0.015, -0.025, -0.035] },
        take: { type: "ladder", steps: [0.015, 0.02, 0.03] },
        stop: { type: "single", k: -0.015 }
      },
      {
        name: "중립", when: ()=> true,
        buy:  { type: "ladder", steps: [-0.002, -0.005] },
        take: { type: "ladder", steps: [0.015, 0.02] },
        stop: { type: "single", k: -0.015 }
      }
    ],
    filters: [],          // 예: (ctx)=> (ctx.rsi??50) < 75
    maxLevels: 5          // 사다리 최대 단계
  },

  // 코인별 오버라이드 (예: 시바이누)
  "KRW-SHIB": {
    lanes: [
      { name:"급등", when:(ctx)=>ctx.rate>=0.05,
        buy:{type:"none"},
        take:{type:"ladder", steps:[0.02,0.035,0.05]},
        stop:{type:"single", k:-0.025}
      },
      { name:"예열", when:(ctx)=>ctx.rate>=0.02&&ctx.rate<0.05,
        buy:{type:"ladder", steps:[-0.004,-0.008,-0.012]},
        take:{type:"ladder", steps:[0.02,0.03,0.045]},
        stop:{type:"single", k:-0.02}
      }
    ]
  },

  // 시간대별 오버라이드(예시)
  timeOverrides: [
    {
      name: "오전 공략",
      when: (ctx)=>{
        const d = ctx.now ?? new Date();
        const h = d.getHours();
        return h>=9 && h<10;
      },
      lanes: [
        { name:"초반가속", when: ()=>true,
          buy:  { type:"ladder", steps:[-0.003, -0.007, -0.012] },
          take: { type:"ladder", steps:[0.02, 0.035, 0.05] },
          stop: { type:"single", k:-0.02 }
        }
      ]
    }
  ]
};
