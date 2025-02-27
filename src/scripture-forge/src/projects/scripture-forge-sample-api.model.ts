import { StatusCodes } from 'http-status-codes';
import { SlingshotDraftBuildInfo, SlingshotDraftBuildState } from 'scripture-forge';
import { Usj } from '@biblionexus-foundation/scripture-utilities';
import { logger } from '@papi/backend';
import { wait } from 'platform-bible-utils';
import ScriptureForgeApi, { ScriptureForgeProjectInfo } from './scripture-forge-api.model';

// The SF API uses null, so we use it here to mimic real responses
/* eslint-disable no-null/no-null */

export default class ScriptureForgeSampleApi extends ScriptureForgeApi {
  private lastJoinedSfTest3Time = 0;
  private firstGetProjectsTime = -1;

  override async getProjects(): Promise<ScriptureForgeProjectInfo[] | StatusCodes> {
    if (this.firstGetProjectsTime < 0) this.firstGetProjectsTime = Date.now();
    // Consider sftest3 to have joined for 10 seconds
    const didSfTest3Join = Date.now() - this.lastJoinedSfTest3Time < 10 * 1000;
    // Pretend sftest6 finished its draft generation after 20 seconds
    const didSfTest6Finish = Date.now() - this.firstGetProjectsTime > 20 * 1000;
    const projects: ScriptureForgeProjectInfo[] = [
      {
        // canSetUp - draftingNotAvailable
        paratextId: 'a7778dadad34e0ecc2e0036d474d75b3c0454273',
        name: 'zzz1 Prod Test',
        shortName: 'zzz1prod',
        languageRegion: null,
        languageScript: null,
        languageTag: 'arb',
        isRightToLeft: null,
        projectId: null,
        isConnectable: true,
        isConnected: false,
        isDraftingEnabled: false,
        hasDraft: false,
      },
      {
        // canSetUp - noFinishedDraft
        paratextId: 'test7',
        name: 'test7',
        shortName: 'test7',
        languageRegion: null,
        languageScript: null,
        languageTag: 'arb',
        isRightToLeft: null,
        projectId: null,
        isConnectable: true,
        isConnected: false,
        isDraftingEnabled: true,
        hasDraft: false,
      },
      {
        // canSetUp - hasFinishedDraft
        paratextId: 'test16',
        name: 'test16',
        shortName: 'test16',
        languageRegion: null,
        languageScript: null,
        languageTag: 'arb',
        isRightToLeft: null,
        projectId: null,
        isConnectable: true,
        isConnected: false,
        isDraftingEnabled: true,
        hasDraft: true,
      },
      {
        // canJoin - draftingNotAvailable
        paratextId: 'test3',
        name: 'test3',
        shortName: 'test3',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: 'sftest3',
        isConnectable: !didSfTest3Join,
        isConnected: didSfTest3Join,
        isDraftingEnabled: false,
        hasDraft: false,
      },
      {
        // canJoin - noFinishedDraft
        paratextId: 'test8',
        name: 'test8',
        shortName: 'test8',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: 'sftest8',
        isConnectable: !didSfTest3Join,
        isConnected: didSfTest3Join,
        isDraftingEnabled: true,
        hasDraft: false,
      },
      {
        // canJoin - hasFinishedDraft
        paratextId: 'test9',
        name: 'test9',
        shortName: 'test9',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: 'sftest9',
        isConnectable: !didSfTest3Join,
        isConnected: didSfTest3Join,
        isDraftingEnabled: true,
        hasDraft: true,
      },
      {
        // cannotSetUp - draftingNotAvailable
        paratextId: 'test10',
        name: 'test10',
        shortName: 'test10',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: null,
        isConnectable: false,
        isConnected: false,
        isDraftingEnabled: false,
        hasDraft: false,
      },
      {
        // cannotSetUp - noFinishedDraft
        paratextId: 'test11',
        name: 'test11',
        shortName: 'test11',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: null,
        isConnectable: false,
        isConnected: false,
        isDraftingEnabled: true,
        hasDraft: false,
      },
      {
        // cannotSetUp - hasFinishedDraft
        paratextId: 'test12',
        name: 'test12',
        shortName: 'test12',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: null,
        isConnectable: false,
        isConnected: false,
        isDraftingEnabled: true,
        hasDraft: true,
      },
      {
        // cannotAccessDrafts - draftingNotAvailable
        paratextId: 'test1',
        name: 'test1',
        shortName: 'test1',
        languageRegion: null,
        languageScript: null,
        languageTag: 'arb',
        isRightToLeft: null,
        projectId: 'sftest1',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: false,
        hasDraft: false,
      },
      {
        // cannotAccessDrafts - noFinishedDraft
        paratextId: 'test13',
        name: 'test13',
        shortName: 'test13',
        languageRegion: null,
        languageScript: null,
        languageTag: 'arb',
        isRightToLeft: null,
        projectId: 'sftest13',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: true,
        hasDraft: false,
      },
      {
        // cannotAccessDrafts - hasFinishedDraft
        paratextId: 'test14',
        name: 'test14',
        shortName: 'test14',
        languageRegion: null,
        languageScript: null,
        languageTag: 'arb',
        isRightToLeft: null,
        projectId: 'sftest14',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: true,
        hasDraft: true,
      },
      {
        // connected - draftingNotAvailable
        paratextId: 'test15',
        name: 'test15',
        shortName: 'test15',
        languageRegion: 'ZW',
        languageScript: 'Latn',
        languageTag: 'lee-ZW',
        isRightToLeft: null,
        projectId: 'sftest15',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: false,
        hasDraft: false,
      },
      {
        // connected - noFinishedDraft; not generating
        paratextId: 'test2',
        name: 'test2',
        shortName: 'test2',
        languageRegion: 'ZW',
        languageScript: 'Latn',
        languageTag: 'lee-ZW',
        isRightToLeft: null,
        projectId: 'sftest2',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: true,
        hasDraft: false,
      },
      {
        // connected - hasFinishedDraft; not generating
        paratextId: '144e90272798340eac0a5c4c0a88340942366316',
        name: 'zzz4 Prod Test',
        shortName: 'zzz4prod',
        languageRegion: 'ZW',
        languageScript: 'Latn',
        languageTag: 'lee-ZW',
        isRightToLeft: null,
        projectId: '67ab7f81f32de1cfd010247f',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: true,
        hasDraft: true,
      },
      {
        // connected - noFinishedDraft; generating
        paratextId: 'test4',
        name: 'test4',
        shortName: 'test4',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: 'sftest4',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: true,
        hasDraft: false,
      },
      {
        // connected - noFinishedDraft; generating (finish generating after a time)
        paratextId: 'test6',
        name: 'test6',
        shortName: 'test6',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: 'sftest6',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: true,
        hasDraft: didSfTest6Finish,
      },
      {
        // connected - hasFinishedDraft; generating
        paratextId: 'test5',
        name: 'test5',
        shortName: 'test5',
        languageRegion: null,
        languageScript: 'Latn',
        languageTag: 'hwc',
        isRightToLeft: null,
        projectId: 'sftest5',
        isConnectable: false,
        isConnected: true,
        isDraftingEnabled: true,
        hasDraft: true,
      },
    ];
    return projects;
  }

  override async joinProject(projectId: string): Promise<undefined | StatusCodes> {
    if (projectId === 'sftest3') {
      // Wait a bit to mimic real load time
      await wait(2000);
      this.lastJoinedSfTest3Time = Date.now();
    }

    logger.info(`Joining project ${projectId}`);

    return undefined;
  }

  override async getLastCompletedDraftStatus(
    projectId: string,
  ): Promise<SlingshotDraftBuildInfo | StatusCodes> {
    // Pretend sftest6 finished its draft generation after 20 seconds
    const didSfTest6Finish = Date.now() - this.firstGetProjectsTime > 20 * 1000;

    const hasDraft = {
      queueDepth: 0,
      additionalInfo: {
        buildId: '67abd170662e9c6f3c42052f',
        corporaIds: ['67abd16f662e9c6f3c420529', '67abd16f662e9c6f3c420527'],
        dateFinished: '2025-02-11T22:53:49.847+00:00',
        parallelCorporaIds: ['67abd170662e9c6f3c42052d', '67abd170662e9c6f3c42052e'],
        step: 0,
        translationEngineId: '67abd16f662e9c6f3c420526',
      },
      revision: 13,
      engine: {
        id: '67ab7f81f32de1cfd010247f',
        href: 'machine-api/v3/translation/engines/project:67ab7f81f32de1cfd010247f',
      },
      percentCompleted: 1,
      message: 'Completed',
      // eslint-disable-next-line no-type-assertion/no-type-assertion
      state: 'COMPLETED' as SlingshotDraftBuildState,
      id: '67ab7f81f32de1cfd010247f.67abd170662e9c6f3c42052f',
      href: 'machine-api/v3/translation/builds/id:67ab7f81f32de1cfd010247f.67abd170662e9c6f3c42052f',
    };
    if (projectId === 'sftest1' || projectId === 'sftest13' || projectId === 'sftest14')
      return StatusCodes.FORBIDDEN;
    if (
      projectId === '67ab7f81f32de1cfd010247f' ||
      projectId === 'sftest5' ||
      (didSfTest6Finish && projectId === 'sftest6') ||
      projectId === 'sftest9'
    )
      return hasDraft;
    return StatusCodes.NO_CONTENT;
  }

  override async getCurrentlyGeneratingDraftStatus(
    projectId: string,
  ): Promise<SlingshotDraftBuildInfo | StatusCodes> {
    // Pretend sftest6 finished its draft generation after 20 seconds
    const didSfTest6Finish = Date.now() - this.firstGetProjectsTime > 20 * 1000;

    const finishedDraft = {
      queueDepth: 0,
      additionalInfo: {
        buildId: '67abd170662e9c6f3c42052f',
        corporaIds: ['67abd16f662e9c6f3c420529', '67abd16f662e9c6f3c420527'],
        dateFinished: '2025-02-11T22:53:49.847+00:00',
        parallelCorporaIds: ['67abd170662e9c6f3c42052d', '67abd170662e9c6f3c42052e'],
        step: 0,
        translationEngineId: '67abd16f662e9c6f3c420526',
      },
      revision: 13,
      engine: {
        id: '67ab7f81f32de1cfd010247f',
        href: 'machine-api/v3/translation/engines/project:67ab7f81f32de1cfd010247f',
      },
      percentCompleted: 1,
      message: 'Completed',
      // eslint-disable-next-line no-type-assertion/no-type-assertion
      state: 'COMPLETED' as SlingshotDraftBuildState,
      id: '67ab7f81f32de1cfd010247f.67abd170662e9c6f3c42052f',
      href: 'machine-api/v3/translation/builds/id:67ab7f81f32de1cfd010247f.67abd170662e9c6f3c42052f',
    };
    const unfinishedDraft = {
      queueDepth: 0,
      additionalInfo: {
        buildId: '67abd170662e9c6f3c42052f',
        corporaIds: ['67abd16f662e9c6f3c420529', '67abd16f662e9c6f3c420527'],
        dateFinished: '2025-02-11T22:53:49.847+00:00',
        parallelCorporaIds: ['67abd170662e9c6f3c42052d', '67abd170662e9c6f3c42052e'],
        step: 0,
        translationEngineId: '67abd16f662e9c6f3c420526',
      },
      revision: 13,
      engine: {
        id: '67ab7f81f32de1cfd010247f',
        href: 'machine-api/v3/translation/engines/project:67ab7f81f32de1cfd010247f',
      },
      percentCompleted: 1,
      message: 'stuff',
      // eslint-disable-next-line no-type-assertion/no-type-assertion
      state: 'ACTIVE' as SlingshotDraftBuildState,
      id: '67ab7f81f32de1cfd010247f.67abd170662e9c6f3c42052f',
      href: 'machine-api/v3/translation/builds/id:67ab7f81f32de1cfd010247f.67abd170662e9c6f3c42052f',
    };
    if (
      projectId === '67ab7f81f32de1cfd010247f' ||
      (didSfTest6Finish && projectId === 'sftest6') ||
      projectId === 'sftest9'
    )
      return finishedDraft;
    if (projectId === 'sftest4' || projectId === 'sftest5' || projectId === 'sftest6')
      return unfinishedDraft;
    return StatusCodes.NO_CONTENT;
  }

  override async getDraftChapterUsx(): Promise<string | StatusCodes> {
    return `<usx version="3.0">
  <book code="RUT" style="id">- zzz4 Prod Test</book>
  <para style="ide" />
  <para style="rem">(ESV converted from Crossway XML)</para>
  <para style="h" />
  <para style="toc3" />
  <para style="toc1" />
  <para style="toc2" />
  <para style="mt1" />
  <chapter number="1" style="c" />
  <para style="s1" />
  <para style="p">
    <verse number="1" style="v" />, "Ngo a time when the judges ruled, there was a famine in the land. And a man went from Bethlehem in Judah to sojourn in the land of Moab, he and his wife and his two sons. <note caller="+" style="x"><char style="ft" closed="false" /></note><note caller="+" style="x"><char style="ft" closed="false">. 1:1. Gen. 12:10; 26:1; 43:1; 2 Ki. 8:1</char></note><note caller="+" style="x"><char style="ft" closed="false" /></note> <verse number="2" style="v" />Nama orang itu Elimelekh, dan nama istrinya Naomi, dan nama kedua anaknya Mahlon dan Kilion. Mereka adalah orang Efrata dari Betlehem di Yehuda. Mereka pergi ke tanah Moab dan tinggal di sana. <note caller="+" style="x"><char style="ft" closed="false" /></note> <verse number="3" style="v" />. Elimelech, the husband of Naomi, died, and she was left with her two sons. Elimelech, the husband of Naomi, died, and she was left with her two sons. Elimelech, the husband of Naomi, died, and she was left with her two sons. <verse number="4" style="v" />, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin <verse number="5" style="v" />Mahlon na Chilion nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw</para>
  <para style="s1">Ruthe's Loyalty to Naomi (Ruth's Loyalty to Naomi)</para>
  <para style="p">
    <verse number="6" style="v" />Lalu bangkitlah Naomi bersama dengan kedua menantunya untuk kembali dari tanah Moab, karena ia mendengar di tanah Moab bahwa TUHAN telah mengunjungi umat-Nya dan telah memberi mereka makanan. <note caller="+" style="x"><char style="ft" closed="false">. 1:6; Eks. 3:16; 4:31; Luk. 1:68</char></note><note caller="+" style="x"><char style="ft" closed="false" /></note> <verse number="7" style="v" />, "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I Am <verse number="8" style="v" />Mais Noémi dit à ses deux belles-filles: Allez, retournez chacune à la maison de sa mère. Que l'Éternel vous fasse miséricorde, comme vous avez fait miséricorde aux morts et à moi! <note caller="+" style="x"><char style="ft" closed="false">. 1:8 Yos. 2:12, 14; Hak. 1:24</char></note><note caller="+" style="x"><char style="ft" closed="false" /></note> <verse number="9" style="v" />? . . . I . . . may the Lord grant you find rest, each of you, in the house of her husband". <note caller="+" style="x"><char style="ft" closed="false" /></note> <verse number="10" style="v" />: "Aye, we will return with thee unto thy people". <verse number="11" style="v" />, "Okay, I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go". <note caller="+" style="x"><char style="ft" closed="false">. 1:11; Dim. 38:11; Dut. 25:5</char></note> <verse number="12" style="v" />내딸들아돌아가라가라, 내가남편을얻을것보다나이노르도다내가희망할것이라고말하여이밤에남편을얻고아들을낳을지라도 <verse number="13" style="v" />, ụmụ m'a, m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a <note caller="+" style="x"><char style="ft" closed="false">[Yob 19:21; Zab. 32:4; 38:2; 39:10]</char></note> <verse number="14" style="v" />? "Iblis, "Oliab, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "I</para>
  <para style="p">
    <verse number="15" style="v" />, "Here, your sister-in-law has returned to her people and her gods. Go back after your sister-in-law". <note caller="+" style="x"><char style="ft" closed="false">. 1:15; Uk. 11:24; 1 Rey. 11:7; Jer. 48:7, 13, 46</char></note> <verse number="16" style="v" />Maar Rut zei: "Doe mij niet te dringen u te verlaten en om u niet meer te volgen; want waar gij gaat, zal ik gaan, en waar gij slaapt, zal ik slapen; uw volk zal mijn volk zijn, en uw God mijn God. <note caller="+" style="x"><char style="ft" closed="false" /></note> <verse number="17" style="v" />, 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I <note caller="+" style="x"><char style="ft" closed="false">. 1:17 1 Sam. 3:17; 25:22; 2 Sam. 19:13; 1 Kgs. 2:23</char></note> <verse number="18" style="v" />, "Here I am!" <note caller="+" style="x"><char style="ft" closed="false">.</char></note></para>
  <para style="s1">uh.</para>
  <para style="p">
    <verse number="19" style="v" />Elles marchèrent donc toutes deux jusqu'à ce qu'elles arrivassent à Bethléem. Quand elles entrèrent à Bethléem, toute la ville fut émue à cause d'elles, et les femmes disaient: Est-ce bien là Noomi? <note caller="+" style="x"><char style="ft" closed="false">. 1:19 [Mat. 21:10]</char></note> <verse number="20" style="v" />, "Use my name, and I will be healed". (Use my name, and I will be healed.) "Use my name, and I will be healed". (Use my name, and I will be healed.) " <note caller="+" style="f"><char style="ft" closed="false">. 1:20 Naomi means pleasant</char></note><note caller="+" style="x"><char style="ft" closed="false" /></note><note caller="+" style="f"><char style="ft" closed="false">1:20 Mara means bitter</char></note> <verse number="21" style="v" />. Ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava nda <note caller="+" style="x"><char style="ft" closed="false" /></note></para>
  <para style="p">
    <verse number="22" style="v" />. Naomi n'a retourné, et Ruth la Moabite, sa belle-fille, avec elle, qui revenait du pays de Moab. Et elles arrivèrent à Bethléhem au commencement de la moisson de l'orge. Ainsi Naomi s'en retourna, et Ruth la Moabite, sa belle-fille, avec elle, qui revenait du pays de Moab. Et elles arrivèrent à Bethléhem au commencement de la moisson de l'orge. <note caller="+" style="x"><char style="ft" closed="false">. 1:22 2 Sam. 21:9; [bab. 2:23]</char></note></para>
</usx>`;
  }

  override async getDraftChapterUsj(): Promise<Usj | StatusCodes> {
    // Don't care about small assertable differences like `closed` attribute being present
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    return {
      type: 'USJ',
      version: '3.1',
      content: [
        {
          type: 'book',
          marker: 'id',
          code: 'RUT',
          content: ['- zzz4 Prod Test'],
        },
        {
          type: 'para',
          marker: 'ide',
        },
        {
          type: 'para',
          marker: 'rem',
          content: ['(ESV converted from Crossway XML)'],
        },
        {
          type: 'para',
          marker: 'h',
        },
        {
          type: 'para',
          marker: 'toc3',
        },
        {
          type: 'para',
          marker: 'toc1',
        },
        {
          type: 'para',
          marker: 'toc2',
        },
        {
          type: 'para',
          marker: 'mt1',
        },
        {
          type: 'chapter',
          marker: 'c',
          number: '1',
        },
        {
          type: 'para',
          marker: 's1',
        },
        {
          type: 'para',
          marker: 'p',
          content: [
            {
              type: 'verse',
              marker: 'v',
              number: '1',
            },
            ', "Ngo a time when the judges ruled, there was a famine in the land. And a man went from Bethlehem in Judah to sojourn in the land of Moab, he and his wife and his two sons. ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:1. Gen. 12:10; 26:1; 43:1; 2 Ki. 8:1'],
                },
              ],
            },
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '2',
            },
            'Nama orang itu Elimelekh, dan nama istrinya Naomi, dan nama kedua anaknya Mahlon dan Kilion. Mereka adalah orang Efrata dari Betlehem di Yehuda. Mereka pergi ke tanah Moab dan tinggal di sana. ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '3',
            },
            '. Elimelech, the husband of Naomi, died, and she was left with her two sons. Elimelech, the husband of Naomi, died, and she was left with her two sons. Elimelech, the husband of Naomi, died, and she was left with her two sons. ',
            {
              type: 'verse',
              marker: 'v',
              number: '4',
            },
            ', Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin, Orin ',
            {
              type: 'verse',
              marker: 'v',
              number: '5',
            },
            'Mahlon na Chilion nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw nw',
          ],
        },
        {
          type: 'para',
          marker: 's1',
          content: ["Ruthe's Loyalty to Naomi (Ruth's Loyalty to Naomi)"],
        },
        {
          type: 'para',
          marker: 'p',
          content: [
            {
              type: 'verse',
              marker: 'v',
              number: '6',
            },
            'Lalu bangkitlah Naomi bersama dengan kedua menantunya untuk kembali dari tanah Moab, karena ia mendengar di tanah Moab bahwa TUHAN telah mengunjungi umat-Nya dan telah memberi mereka makanan. ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:6; Eks. 3:16; 4:31; Luk. 1:68'],
                },
              ],
            },
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '7',
            },
            ', "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I am!" "Here I Am ',
            {
              type: 'verse',
              marker: 'v',
              number: '8',
            },
            "Mais Noémi dit à ses deux belles-filles: Allez, retournez chacune à la maison de sa mère. Que l'Éternel vous fasse miséricorde, comme vous avez fait miséricorde aux morts et à moi! ",
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:8 Yos. 2:12, 14; Hak. 1:24'],
                },
              ],
            },
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '9',
            },
            '? . . . I . . . may the Lord grant you find rest, each of you, in the house of her husband". ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '10',
            },
            ': "Aye, we will return with thee unto thy people". ',
            {
              type: 'verse',
              marker: 'v',
              number: '11',
            },
            ", \"Okay, I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go. I'm not going to let you go\". ",
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:11; Dim. 38:11; Dut. 25:5'],
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '12',
            },
            '내딸들아돌아가라가라, 내가남편을얻을것보다나이노르도다내가희망할것이라고말하여이밤에남편을얻고아들을낳을지라도 ',
            {
              type: 'verse',
              marker: 'v',
              number: '13',
            },
            ", ụmụ m'a, m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a m'a ",
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['[Yob 19:21; Zab. 32:4; 38:2; 39:10]'],
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '14',
            },
            '? "Iblis, "Oliab, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "Iblis, "I',
          ],
        },
        {
          type: 'para',
          marker: 'p',
          content: [
            {
              type: 'verse',
              marker: 'v',
              number: '15',
            },
            ', "Here, your sister-in-law has returned to her people and her gods. Go back after your sister-in-law". ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:15; Uk. 11:24; 1 Rey. 11:7; Jer. 48:7, 13, 46'],
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '16',
            },
            'Maar Rut zei: "Doe mij niet te dringen u te verlaten en om u niet meer te volgen; want waar gij gaat, zal ik gaan, en waar gij slaapt, zal ik slapen; uw volk zal mijn volk zijn, en uw God mijn God. ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '17',
            },
            ", 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die, and I will be buried.' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I will die,' 'I ",
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:17 1 Sam. 3:17; 25:22; 2 Sam. 19:13; 1 Kgs. 2:23'],
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '18',
            },
            ', "Here I am!" ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['.'],
                },
              ],
            },
          ],
        },
        {
          type: 'para',
          marker: 's1',
          content: ['uh.'],
        },
        {
          type: 'para',
          marker: 'p',
          content: [
            {
              type: 'verse',
              marker: 'v',
              number: '19',
            },
            "Elles marchèrent donc toutes deux jusqu'à ce qu'elles arrivassent à Bethléem. Quand elles entrèrent à Bethléem, toute la ville fut émue à cause d'elles, et les femmes disaient: Est-ce bien là Noomi? ",
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:19 [Mat. 21:10]'],
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '20',
            },
            ', "Use my name, and I will be healed". (Use my name, and I will be healed.) "Use my name, and I will be healed". (Use my name, and I will be healed.) " ',
            {
              type: 'note',
              marker: 'f',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:20 Naomi means pleasant'],
                },
              ],
            },
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
            {
              type: 'note',
              marker: 'f',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['1:20 Mara means bitter'],
                },
              ],
            },
            ' ',
            {
              type: 'verse',
              marker: 'v',
              number: '21',
            },
            '. Ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava ndava nda ',
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                },
              ],
            },
          ],
        },
        {
          type: 'para',
          marker: 'p',
          content: [
            {
              type: 'verse',
              marker: 'v',
              number: '22',
            },
            ". Naomi n'a retourné, et Ruth la Moabite, sa belle-fille, avec elle, qui revenait du pays de Moab. Et elles arrivèrent à Bethléhem au commencement de la moisson de l'orge. Ainsi Naomi s'en retourna, et Ruth la Moabite, sa belle-fille, avec elle, qui revenait du pays de Moab. Et elles arrivèrent à Bethléhem au commencement de la moisson de l'orge. ",
            {
              type: 'note',
              marker: 'x',
              caller: '+',
              content: [
                {
                  type: 'char',
                  marker: 'ft',
                  closed: 'false',
                  content: ['. 1:22 2 Sam. 21:9; [bab. 2:23]'],
                },
              ],
            },
          ],
        },
      ],
    } as Usj;
  }
}
