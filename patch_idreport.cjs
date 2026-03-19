const fs = require('fs');

let code = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

const targetStr = `    // ── 최종 출력 ──
    out.innerHTML = sectionA + sectionB + sectionC + sectionD + sectionE + sectionF + sectionG + sectionH + sectionI;`;

const newCode = `
    // ── 섹션J: 직급 승격 및 균형 매출 분석 ──
    let sectionJ = '';
    try {
      const promoSnap = await getDoc(doc(db, 'settings', 'rankPromotion'));
      let promoSettings = { enableAutoPromotion: false, useBalancedVolume: false, networkDepth: 3, excludeTopLines: 1, criteria: {} };
      if (promoSnap.exists()) {
        promoSettings = promoSnap.data();
        if (promoSettings.criteriaJson) {
          try { promoSettings.criteria = JSON.parse(promoSettings.criteriaJson); } catch(e){}
        }
      }

      const pDepth = promoSettings.networkDepth || 3;
      const excludeTopLines = promoSettings.excludeTopLines || 1;
      const useBalancedVol = promoSettings.useBalancedVolume === true;

      // 1) 전체 산하 구하기 (지정된 Depth까지)
      let dlLevel = [target.id];
      let allDownlineIds = [];
      for (let d = 0; d < pDepth; d++) {
        const next = allUsers.filter(u => dlLevel.includes(u.referredBy)).map(u => u.id);
        allDownlineIds.push(...next);
        dlLevel = next;
        if (!next.length) break;
      }

      // 2) 전체 네트워크 매출
      let totalNetworkSales = 0;
      const legSales = [];

      if (allDownlineIds.length > 0) {
        const chunks = [];
        for (let i=0; i<allDownlineIds.length; i+=30) chunks.push(allDownlineIds.slice(i, i+30));
        for (const chunk of chunks) {
          const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', 'in', chunk), where('type', '==', 'deposit'), where('status', '==', 'approved')));
          totalNetworkSales += txSnap.docs.reduce((s,d) => s + (d.data().amount||0), 0);
        }

        // 직1대(레그별) 그룹 아이디 수집 헬퍼
        const getLineIds = (rootId) => {
          const ids = new Set([rootId]);
          let frontier = [rootId];
          while (frontier.length > 0) {
            const next = allUsers.filter(u => frontier.includes(u.referredBy)).map(u => u.id);
            next.forEach(id => ids.add(id));
            frontier = next;
          }
          return [...ids];
        };

        // 레그별 매출 합산
        for (const g1 of gen1) {
          const lineIds = getLineIds(g1.id).filter(id => allDownlineIds.includes(id));
          if (lineIds.length === 0) { legSales.push({ user: g1, sales: 0 }); continue; }
          let sales = 0;
          const lChunks = [];
          for(let i=0; i<lineIds.length; i+=30) lChunks.push(lineIds.slice(i, i+30));
          for(const chunk of lChunks) {
            const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', 'in', chunk), where('type', '==', 'deposit'), where('status', '==', 'approved')));
            sales += txSnap.docs.reduce((s,d) => s + (d.data().amount||0), 0);
          }
          legSales.push({ user: g1, sales });
        }
      }

      legSales.sort((a,b) => b.sales - a.sales);
      
      let balancedVolume = totalNetworkSales;
      let excludedLegs = [];
      let includedLegs = [];
      
      if (useBalancedVol && legSales.length > 0) {
        excludedLegs = legSales.slice(0, excludeTopLines);
        includedLegs = legSales.slice(excludeTopLines);
        balancedVolume = includedLegs.reduce((s, l) => s + l.sales, 0);
      } else {
        includedLegs = legSales;
      }

      const nextRankIdx = rankIdx(target.rank || 'G0') + 1;
      const nextRank = nextRankIdx < RANK_ORDER.length ? RANK_ORDER[nextRankIdx] : null;
      const nextCrit = nextRank && promoSettings.criteria ? promoSettings.criteria[nextRank] : null;
      
      const selfInvest = activeInvests.reduce((s,i)=>s+(i.amount||0),0);

      let rankPromoBody = \`<div style="font-size:13px;color:#374151;margin-bottom:12px;">\`;
      rankPromoBody += \`본인 활성 투자: <b style="color:#10b981;">$\${fmt2(selfInvest)}</b><br>\`;
      rankPromoBody += \`산하 인원 수 (\${pDepth}대): <b>\${allDownlineIds.length}명</b><br>\`;
      rankPromoBody += \`산하 전체 매출 (\${pDepth}대): <b>$\${fmt2(totalNetworkSales)}</b><br>\`;
      rankPromoBody += \`</div>\`;

      if (useBalancedVol) {
        rankPromoBody += \`<div style="padding:12px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:8px;"><i class="fas fa-balance-scale"></i> 균형 매출 (최상위 \${excludeTopLines}개 라인 제외)</div>\`;
        
        if (excludedLegs.length > 0) {
            rankPromoBody += \`<div style="font-size:12px;color:#991b1b;margin-bottom:4px;">[제외된 라인]</div>\`;
            excludedLegs.forEach((l, i) => {
                rankPromoBody += \`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 8px;background:#fee2e2;border-radius:4px;margin-bottom:4px;">
                    <span>\${i+1}. \${l.user.name||l.user.id} (\${l.user.id})</span>
                    <b style="color:#b91c1c;">$\${fmt2(l.sales)}</b>
                </div>\`;
            });
        }
        
        rankPromoBody += \`<div style="font-size:12px;color:#065f46;margin-top:8px;margin-bottom:4px;">[실적 인정 라인]</div>\`;
        if (includedLegs.length > 0) {
            includedLegs.forEach((l, i) => {
                rankPromoBody += \`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 8px;background:#dcfce7;border-radius:4px;margin-bottom:4px;">
                    <span>\${l.user.name||l.user.id} (\${l.user.id})</span>
                    <b style="color:#047857;">$\${fmt2(l.sales)}</b>
                </div>\`;
            });
        } else {
            rankPromoBody += \`<div style="font-size:11px;color:#6b7280;padding:4px;">인정되는 하위 라인이 없습니다.</div>\`;
        }

        rankPromoBody += \`<div style="margin-top:10px;text-align:right;font-size:14px;">
            최종 실적 인정 균형 매출: <b style="color:#dc2626;">$\${fmt2(balancedVolume)}</b>
        </div></div>\`;
      } else {
        rankPromoBody += \`<div style="font-size:11px;color:#6b7280;padding:4px;">※ 균형 매출 조건 미사용 (전체 매출 인정)</div>\`;
      }

      if (nextCrit) {
          const meetsInvest = selfInvest >= (nextCrit.minSelfInvest||0);
          const meetsSales = totalNetworkSales >= (nextCrit.minNetworkSales||0);
          const meetsBV = balancedVolume >= (nextCrit.minBalancedVolume||0);
          const meetsMembers = allDownlineIds.length >= (nextCrit.minNetworkMembers||0);
          
          rankPromoBody += \`<div style="padding:12px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
              <div style="font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:8px;">🚀 다음 직급(\${nextRank}) 승격 조건</div>
              <table style="width:100%;font-size:12px;border-collapse:collapse;">
                  <tr style="border-bottom:1px solid #dbeafe;">
                      <td style="padding:4px 0;">본인 투자 ($\${nextCrit.minSelfInvest||0} 이상)</td>
                      <td style="text-align:right;font-weight:700;color:\${meetsInvest?'#10b981':'#ef4444'};\"><span style="font-size:10px;font-weight:normal;color:#94a3b8;margin-right:6px;">($\${fmt2(selfInvest)})</span> \${meetsInvest?'✅충족':'❌미달'}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #dbeafe;">
                      <td style="padding:4px 0;">산하 인원 (\${nextCrit.minNetworkMembers||0}명 이상)</td>
                      <td style="text-align:right;font-weight:700;color:\${meetsMembers?'#10b981':'#ef4444'};\"><span style="font-size:10px;font-weight:normal;color:#94a3b8;margin-right:6px;">(\${allDownlineIds.length}명)</span> \${meetsMembers?'✅충족':'❌미달'}</td>
                  </tr>
                  \${!useBalancedVol ? \`
                  <tr style="border-bottom:1px solid #dbeafe;">
                      <td style="padding:4px 0;">산하 매출 ($\${nextCrit.minNetworkSales||0} 이상)</td>
                      <td style="text-align:right;font-weight:700;color:\${meetsSales?'#10b981':'#ef4444'};\"><span style="font-size:10px;font-weight:normal;color:#94a3b8;margin-right:6px;">($\${fmt2(totalNetworkSales)})</span> \${meetsSales?'✅충족':'❌미달'}</td>
                  </tr>\` : ''}
                  \${useBalancedVol && (nextCrit.minBalancedVolume||0) > 0 ? \`
                  <tr>
                      <td style="padding:4px 0;">균형 매출 ($\${nextCrit.minBalancedVolume||0} 이상)</td>
                      <td style="text-align:right;font-weight:700;color:\${meetsBV?'#10b981':'#ef4444'};\"><span style="font-size:10px;font-weight:normal;color:#94a3b8;margin-right:6px;">($\${fmt2(balancedVolume)})</span> \${meetsBV?'✅충족':'❌미달'}</td>
                  </tr>\` : ''}
              </table>
          </div>\`;
      } else {
          rankPromoBody += \`<div style="padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;">최고 직급이거나 다음 직급 조건이 설정되지 않았습니다.</div>\`;
      }

      sectionJ = card('⚖️ 직급 승격 및 균형 매출 분석', rankPromoBody);
    } catch(e) {
      console.error(e);
    }

    // ── 최종 출력 ──
    out.innerHTML = sectionA + sectionJ + sectionB + sectionC + sectionD + sectionE + sectionF + sectionG + sectionH + sectionI;`;

if(code.includes(targetStr)) {
    code = code.replace(targetStr, newCode);
    fs.writeFileSync('/home/user/webapp/public/static/admin.html', code);
    console.log("Patched successfully!");
} else {
    console.log("Could not find target string.");
}
